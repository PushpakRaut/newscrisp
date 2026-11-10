export const CATEGORIES = [
  "india",
  "world",
  "business",
  "technology",
  "sports",
  "entertainment",
  "science",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** A story as it comes out of an RSS feed, before summarizing. */
export interface RawArticle {
  id: string;
  title: string;
  link: string;
  source: string;
  category: Category;
  publishedAt: string; // ISO
  image: string | null;
  snippet: string; // plain text from the feed
  body?: string; // main text read from the article page, when it could be read
}

/** A story card shown in the app. */
export interface Short {
  id: string;
  headline: string;
  summary: string; // <= 60 words
  category: Category;
  source: string;
  link: string;
  image: string | null;
  publishedAt: string;
  /** ai: written by Claude from the article. article: the article's opening lines. feed: the RSS description. */
  summaryBy: "ai" | "article" | "feed";
  /** Other outlets that covered the same story (merged duplicates). */
  alsoCoveredBy: string[];
}

export interface Comment {
  id: string;
  shortId: string;
  handle: string;
  text: string;
  createdAt: string;
}

export interface FeedResponse {
  shorts: Short[];
  comments: Record<string, number>;
  fetchedAt: string;
  aiSummaries: boolean;
  failedSources: string[];
}
