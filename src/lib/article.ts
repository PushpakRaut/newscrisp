/**
 * Reads the story text from an article's own web page, so summaries are built from the
 * article itself rather than the one- or two-line description most RSS feeds carry.
 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
  ndash: "–", mdash: "—", hellip: "…", rupee: "₹", pound: "£", euro: "€", copy: "©", deg: "°",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    }
    return NAMED[code.toLowerCase()] ?? whole;
  });
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

// Page furniture that sits in <p> tags but isn't the story.
const BOILERPLATE =
  /(cookie|subscribe|subscription|sign up|sign in|log ?in|newsletter|all rights reserved|©|follow us|download (the|our) app|click here|read more|also read|advertisement|whatsapp channel|share this|terms of use|privacy policy|unlock this|premium story)/i;

function findArticleBody(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findArticleBody(n);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (typeof obj.articleBody === "string" && obj.articleBody.length > 200) return obj.articleBody;
  for (const v of Object.values(obj)) {
    const hit = findArticleBody(v);
    if (hit) return hit;
  }
  return null;
}

function paragraphs(scope: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const p = stripHtml(m[1]);
    if (p.length < 60 || words(p) < 10 || BOILERPLATE.test(p) || !/[.!?"”’]$/.test(p)) continue;
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

/** Pull the article's main text out of its HTML: structured data first, then paragraphs. */
export function extractArticleText(html: string, maxWords = 700): string {
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const body = findArticleBody(JSON.parse(m[1].trim()));
      if (body) {
        const text = stripHtml(body);
        if (words(text) >= 40) return limit(text, maxWords);
      }
    } catch {
      /* malformed JSON-LD: try the next block */
    }
  }
  const scoped = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0];
  let paras = scoped ? paragraphs(scoped) : [];
  if (words(paras.join(" ")) < 40) paras = paragraphs(html);
  return limit(paras.join(" "), maxWords);
}

function limit(text: string, maxWords: number) {
  const list = text.split(/\s+/).filter(Boolean);
  return list.length <= maxWords ? list.join(" ") : list.slice(0, maxWords).join(" ");
}

const bodyCache = new Map<string, string>(); // link -> article text ("" when unreadable)

async function fetchArticleText(link: string): Promise<string> {
  const hit = bodyCache.get(link);
  if (hit !== undefined) return hit;
  let text = "";
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": "NewsCrisp/0.1 (news summary reader)", Accept: "text/html" },
      signal: AbortSignal.timeout(6000),
      redirect: "follow",
    });
    if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) text = extractArticleText(await res.text());
  } catch {
    /* blocked, slow or offline: the feed text is used instead */
  }
  bodyCache.set(link, text);
  if (bodyCache.size > 2000) bodyCache.delete(bodyCache.keys().next().value!);
  return text;
}

/**
 * Fetch article text for many links, a few at a time. Waits at most `deadlineMs`; anything
 * slower keeps loading in the background and is ready for the next refresh.
 */
export async function fetchArticleTexts(links: string[], concurrency = 10, deadlineMs = 15_000) {
  const out = new Map<string, string>();
  const queue = [...new Set(links)];
  const worker = async () => {
    for (let link = queue.shift(); link; link = queue.shift()) out.set(link, await fetchArticleText(link));
  };
  const all = Promise.all(Array.from({ length: concurrency }, worker));
  await Promise.race([all, new Promise((r) => setTimeout(r, deadlineMs))]);
  return out;
}
