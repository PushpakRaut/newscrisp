import { createHash } from "node:crypto";
import Parser from "rss-parser";
import { SOURCES, type FeedSource } from "./sources";
import { fetchArticleTexts, stripHtml } from "./article";
import { summarizeAll } from "./summarize";
import type { RawArticle, Short } from "./types";

type MediaItem = {
  "media:content"?: { $?: { url?: string; medium?: string } } | { $?: { url?: string } }[];
  "media:thumbnail"?: { $?: { url?: string } } | { $?: { url?: string } }[];
  "content:encoded"?: string;
};

const parser: Parser<object, MediaItem> = new Parser({
  timeout: 8000,
  headers: { "User-Agent": "newscrisp-mvp/0.1 (RSS reader)" },
  customFields: { item: ["media:content", "media:thumbnail", "content:encoded"] },
});

const CACHE_MS = 10 * 60_000;
const MAX_AGE_MS = 3 * 24 * 60 * 60_000;
const PER_FEED = 12;

type Built = { shorts: Short[]; fetchedAt: string; failedSources: string[] };
let cached: Built | null = null;
let cachedAt = 0;
let inflight: Promise<Built> | null = null;

function firstUrl(v: unknown): string | null {
  const list = Array.isArray(v) ? v : v ? [v] : [];
  for (const m of list) {
    const url = (m as { $?: { url?: string } })?.$?.url;
    if (url) return url;
  }
  return null;
}

/** Some feeds ship tiny thumbnails; ask for a bigger size where the URL allows it. */
function upsize(url: string): string {
  return url.replace(/(ichef\.bbci\.co\.uk\/(?:ace\/)?(?:standard|news))\/\d+\//, "$1/800/");
}

function pickImage(item: Parser.Item & MediaItem): string | null {
  const img = pickImageRaw(item);
  return img ? upsize(img) : null;
}

function pickImageRaw(item: Parser.Item & MediaItem): string | null {
  const fromMedia = firstUrl(item["media:content"]) ?? firstUrl(item["media:thumbnail"]);
  if (fromMedia) return fromMedia;
  if (item.enclosure?.url && (item.enclosure.type ?? "image").startsWith("image")) return item.enclosure.url;
  const html = item["content:encoded"] ?? item.content ?? "";
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function idFor(link: string) {
  return createHash("sha1").update(link).digest("hex").slice(0, 12);
}

async function fetchSource(src: FeedSource): Promise<RawArticle[]> {
  const feed = await parser.parseURL(src.url);
  const now = Date.now();
  return (feed.items ?? [])
    .filter((it) => it.link && it.title)
    .slice(0, PER_FEED)
    .map((it) => {
      const published = it.isoDate ?? it.pubDate ?? new Date().toISOString();
      const snippet = stripHtml(it["content:encoded"] ?? it.content ?? it.contentSnippet ?? it.summary ?? "");
      return {
        id: idFor(it.link!),
        title: stripHtml(it.title!),
        link: it.link!,
        source: src.name,
        category: src.category,
        publishedAt: new Date(published).toISOString(),
        image: pickImage(it),
        snippet,
      };
    })
    .filter((a) => now - new Date(a.publishedAt).getTime() < MAX_AGE_MS);
}

const STOPWORDS = new Set(
  "a an the of to in on for and or but with at by from as is are was were be been after over into says said amid new its it this that".split(" "),
);

function titleTokens(t: string) {
  return new Set(
    t.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function similarity(a: Set<string>, b: Set<string>) {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Merge stories that several outlets covered, so the feed doesn't repeat itself. */
function dedupe(articles: RawArticle[]): { kept: RawArticle[]; alsoBy: Map<string, string[]> } {
  const kept: RawArticle[] = [];
  const tokens: Set<string>[] = [];
  const alsoBy = new Map<string, string[]>();
  const seenLinks = new Set<string>();
  // Prefer the version with the most text and an image.
  const ranked = [...articles].sort(
    (x, y) => Number(!!y.image) - Number(!!x.image) || y.snippet.length - x.snippet.length,
  );
  for (const a of ranked) {
    if (seenLinks.has(a.link)) continue;
    seenLinks.add(a.link);
    const t = titleTokens(a.title);
    const dup = tokens.findIndex((k) => similarity(k, t) >= 0.5);
    if (dup >= 0) {
      const keeper = kept[dup];
      const list = alsoBy.get(keeper.id) ?? [];
      if (a.source !== keeper.source && !list.includes(a.source)) list.push(a.source);
      alsoBy.set(keeper.id, list);
      continue;
    }
    kept.push(a);
    tokens.push(t);
  }
  return { kept, alsoBy };
}

async function build(): Promise<Built> {
  const results = await Promise.allSettled(SOURCES.map(fetchSource));
  const failedSources: string[] = [];
  const all: RawArticle[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") all.push(...r.value);
    else failedSources.push(`${SOURCES[i].name} (${SOURCES[i].category})`);
  });

  const { kept, alsoBy } = dedupe(all);
  kept.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const top = kept.slice(0, 90);

  // Most feeds carry only a line or two, so read each article's own page for the full story text.
  const bodies = await fetchArticleTexts(top.map((a) => a.link));
  for (const a of top) a.body = bodies.get(a.link) ?? "";

  const summaries = await summarizeAll(top);
  const shorts: Short[] = top.map((a) => {
    const s = summaries.get(a.id)!;
    return {
      id: a.id,
      headline: s.headline,
      summary: s.summary,
      category: s.category,
      source: a.source,
      link: a.link,
      image: a.image,
      publishedAt: a.publishedAt,
      summaryBy: s.by,
      alsoCoveredBy: alsoBy.get(a.id) ?? [],
    };
  });
  return { shorts, fetchedAt: new Date().toISOString(), failedSources };
}

export async function getShorts() {
  if (cached && Date.now() - cachedAt < CACHE_MS) {
    return { ...cached, aiSummaries: cached.shorts.some((s) => s.summaryBy === "ai") };
  }
  if (!inflight) {
    inflight = build()
      .then((res) => {
        if (res.shorts.length) {
          cached = res;
          cachedAt = Date.now();
        }
        return res;
      })
      .finally(() => {
        inflight = null;
      });
  }
  const res = await inflight;
  return { ...res, aiSummaries: res.shorts.some((s) => s.summaryBy === "ai") };
}
