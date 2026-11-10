import type { Edition } from "./types";

/**
 * Which version of NewsCrisp this server runs.
 * - "public" (the default, so a deploy is safe even if the setting is forgotten): only what
 *   publishers offer in their RSS feeds. Headline, short description and a link back.
 *   No article pages are read, no AI rewriting, no publisher photos, no ads.
 * - "full": the private version. Reads article pages for longer summaries, uses Claude when a
 *   key is set, and shows publisher photos. Set NEWSCRISP_EDITION=full in .env.local.
 */
export const EDITION: Edition = process.env.NEWSCRISP_EDITION === "full" ? "full" : "public";
export const IS_PUBLIC = EDITION === "public";

/** Longest description the public edition shows, in words. */
export const PUBLIC_MAX_WORDS = 40;
