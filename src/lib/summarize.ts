import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES, type Category, type RawArticle } from "./types";

// Haiku is the low-cost model: $0.10 / $0.50 per million input / output tokens.
const MODEL = "claude-haiku-5-5";
const BATCH_SIZE = 15;
const MAX_WORDS = 60;

export interface Summary {
  id: string;
  headline: string;
  summary: string;
  category: Category;
}

const SYSTEM_PROMPT = `You write news shorts for a mobile news app. Each short has a headline and a summary of at most ${MAX_WORDS} words.

Rules:
- Use only facts stated in the article text you are given. Never add facts, numbers, names or context from elsewhere.
- Aim for 50 to ${MAX_WORDS} words: what happened, who is involved, and the key detail or number. Only write less when the text itself is short.
- Neutral, plain language. No opinion, no adjectives that judge, no hype, no questions, no "click to know" teasers.
- The headline is a factual statement of at most 12 words. It must match what the summary says.
- The summary must stand on its own: the reader should not have to open the source to know what happened.
- Attribute claims ("police said", "the company said") when the text does.
- Pick the single best category from the allowed list.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          headline: { type: "string" },
          summary: { type: "string" },
          category: { type: "string", enum: [...CATEGORIES] },
        },
        required: ["id", "headline", "summary", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};

let client: Anthropic | null = null;
let disabledUntil = 0;
let lastError: string | null = null;

function getClient(): Anthropic | null {
  if (process.env.USE_AI === "0") return null;
  if (Date.now() < disabledUntil) return null;
  if (!client) {
    try {
      client = new Anthropic();
    } catch (err) {
      disable(err, 10 * 60_000);
      return null;
    }
  }
  return client;
}

function disable(err: unknown, ms: number) {
  if (Date.now() < disabledUntil) return; // parallel batches fail together; log once
  disabledUntil = Date.now() + ms;
  lastError = err instanceof Error ? err.message : String(err);
  console.warn(`[summarize] AI summaries off for ${ms / 60_000} min: ${lastError}`);
}

export function aiStatus() {
  return { enabled: Date.now() >= disabledUntil && process.env.USE_AI !== "0", lastError };
}

/** Cut text to at most `max` words, ending on a full sentence when possible. */
export function trimWords(text: string, max = MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= max) return words.join(" ");
  const cut = words.slice(0, max).join(" ");
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (lastStop > cut.length * 0.5) return cut.slice(0, lastStop + 1);
  return cut.replace(/[,;:\s]+$/, "") + "…";
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** The article's opening sentences, about 45-60 words, skipping a repeat of the headline. */
function leadSummary(text: string, headline: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]*/g) ?? [text];
  const head = norm(headline).slice(0, 40);
  const out: string[] = [];
  let n = 0;
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s || (head && norm(s).startsWith(head))) continue;
    const w = countWords(s);
    if (n + w > MAX_WORDS && n >= 25) break;
    out.push(s);
    n += w;
    if (n >= 45) break;
  }
  return trimWords(out.join(" "));
}

/** Fallback when the AI isn't available: the article's opening lines, or else the feed's own text. */
function fallbackSummary(a: RawArticle): Summary & { by: "article" | "feed" } {
  if (a.body && countWords(a.body) >= 40) {
    const lead = leadSummary(a.body, a.title);
    if (countWords(lead) >= 25) return { id: a.id, headline: a.title, summary: lead, category: a.category, by: "article" };
  }
  // Some feeds repeat the headline as the description; don't show it twice.
  const usable = a.snippet.length > 40 && !norm(a.snippet).startsWith(norm(a.title).slice(0, 60));
  return { id: a.id, headline: a.title, summary: usable ? trimWords(a.snippet) : "", category: a.category, by: "feed" };
}

async function summarizeBatch(ai: Anthropic, batch: RawArticle[]): Promise<Map<string, Summary>> {
  const input = batch.map((a) => ({
    id: a.id,
    source: a.source,
    feed_category: a.category,
    title: a.title,
    text: (a.body && a.body.length > a.snippet.length ? a.body : a.snippet).slice(0, 4000),
  }));

  const response = await ai.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Write one short for each article. Return them under "items", keeping each article's id.\n\n${JSON.stringify(input)}`,
      },
    ],
  });

  const out = new Map<string, Summary>();
  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    console.warn(`[summarize] batch stopped early: ${response.stop_reason}`);
    return out;
  }
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    const parsed = JSON.parse(text) as { items: Summary[] };
    const ids = new Set(batch.map((a) => a.id));
    for (const item of parsed.items) {
      if (!ids.has(item.id)) continue;
      out.set(item.id, { ...item, summary: trimWords(item.summary), headline: item.headline.trim() });
    }
  } catch {
    console.warn("[summarize] could not parse model output");
  }
  return out;
}

/**
 * Summarize articles with Claude, falling back to the feed's own text for
 * any article the AI couldn't handle. Results are cached by article id.
 */
type Result = Summary & { by: "ai" | "article" | "feed" };
const cache = new Map<string, Result>();

export async function summarizeAll(articles: RawArticle[]): Promise<Map<string, Result>> {
  const result = new Map<string, Result>();
  const todo: RawArticle[] = [];
  for (const a of articles) {
    const hit = cache.get(a.id);
    if (hit && hit.by === "ai") result.set(a.id, hit);
    else todo.push(a);
  }

  const ai = getClient();
  if (ai && todo.length) {
    const batches: RawArticle[][] = [];
    for (let i = 0; i < todo.length; i += BATCH_SIZE) batches.push(todo.slice(i, i + BATCH_SIZE));
    const settled = await Promise.allSettled(batches.map((b) => summarizeBatch(ai, b)));
    for (const s of settled) {
      if (s.status === "fulfilled") {
        for (const [id, sum] of s.value) {
          const entry = { ...sum, by: "ai" as const };
          cache.set(id, entry);
          result.set(id, entry);
        }
      } else {
        const err = s.reason;
        if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
          disable(err, 30 * 60_000);
        } else if (err instanceof Anthropic.RateLimitError) {
          disable(err, 2 * 60_000);
        } else if (err instanceof Anthropic.APIError) {
          console.warn(`[summarize] API error ${err.status}: ${err.message}`);
        } else {
          // Usually missing credentials or no network.
          disable(err, 10 * 60_000);
        }
      }
    }
  }

  for (const a of todo) {
    if (!result.has(a.id)) {
      const entry = fallbackSummary(a);
      cache.set(a.id, entry);
      result.set(a.id, entry);
    }
  }
  return result;
}
