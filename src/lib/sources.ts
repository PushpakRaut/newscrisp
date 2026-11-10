import type { Category } from "./types";

export interface FeedSource {
  name: string;
  url: string;
  category: Category;
}

/**
 * Public RSS feeds. Every card credits the outlet and links back to the
 * original article, the way news aggregators usually work. Before launching
 * for real, check each publisher's terms for commercial use of their feed.
 */
export const SOURCES: FeedSource[] = [
  { name: "The Hindu", url: "https://www.thehindu.com/news/national/feeder/default.rss", category: "india" },
  { name: "Indian Express", url: "https://indianexpress.com/section/india/feed/", category: "india" },
  { name: "NDTV", url: "https://feeds.feedburner.com/ndtvnews-top-stories", category: "india" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/world/rss.xml", category: "world" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", category: "world" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "business" },
  { name: "Livemint", url: "https://www.livemint.com/rss/markets", category: "business" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/", category: "technology" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "technology" },
  { name: "ESPNcricinfo", url: "https://www.espncricinfo.com/rss/content/story/feeds/0.xml", category: "sports" },
  { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/rss.xml", category: "sports" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", category: "entertainment" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", category: "science" },
];
