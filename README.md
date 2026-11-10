# NewsCrisp (MVP)

Today's news, one story per screen, each summarized in 60 words. Swipe up for the next story. The look is editorial paper: ivory pages, Newsreader serif headlines, small-caps labels and a rust accent, with a deep navy dark mode (warm ivory text, copper accent). The motion follows Apple's approach: springs, sheets you can drag away, and reduced-motion fallbacks.

## Two editions

The same code runs as one of two editions, chosen by the `NEWSCRISP_EDITION` setting.

| | Public (default) | Full (private) |
|---|---|---|
| How to run it | `npm run dev` | `npm run dev:full`, or `NEWSCRISP_EDITION=full` in `.env.local` |
| Story text | The feed's own short description, at most 40 words | Summary built from the article page, or by Claude when a key is set |
| Article pages | Never read | Read for summaries |
| Photos | None; topic icons instead | Publisher photos |
| AI | Off | On when `ANTHROPIC_API_KEY` is set |
| Ads, reports | Off | Placeholder ad cards; reports saved to `.data/` |
| Shared text | Headline and link | Headline, summary and link |

The public edition is the default, so a deploy is public-safe even if you forget the setting. It shows only what publishers put in their public RSS feeds, credits each outlet, and links to the original article. It has an About page (the ⓘ button) listing the sources and explaining privacy. Set `NEXT_PUBLIC_CONTACT_EMAIL` to give publishers a contact for removal requests.

This lowers the legal risk but doesn't remove it: check each outlet's feed terms before running ads, and get legal advice before a commercial launch. The full version is saved at git tag `full-version`.

### Deploy the public edition (Vercel, free)

1. Push this repository to GitHub.
2. At vercel.com, choose Add New → Project and import the repository.
3. Optionally add `NEXT_PUBLIC_CONTACT_EMAIL` under Settings → Environment Variables. Don't set `NEWSCRISP_EDITION` or `ANTHROPIC_API_KEY`.
4. Deploy.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app is built for a phone-sized screen; on desktop it shows as a centred column.

### AI summaries (optional)

Most RSS feeds carry only a line or two, so the app also reads each article's own page (`src/lib/article.ts`). It uses the page's structured `articleBody` when there is one, otherwise the main paragraphs. Fetching all 90 articles takes about 1–2 seconds. Some sites block automated reads (ESPNcricinfo, some Al Jazeera pages); those stories fall back to the feed text.

Without an API key, each card shows the article's opening sentences, about 45–60 words. That copies the publisher's words, so use AI summaries and check each outlet's terms before a public launch. To have Claude write the summaries from the full article text, create `.env.local` with:

```
ANTHROPIC_API_KEY=sk-ant-your-key
```

Summaries come from `claude-haiku-5-5`, the low-cost model, at low effort, in batches of 15. That works out to well under a cent per refresh of about 90 stories, and each article is only summarized once. Set `USE_AI=0` to turn AI summaries off.

## What's in it

| Area | Files |
|---|---|
| News sources (RSS) | `src/lib/sources.ts` |
| Fetch, merge duplicates, cache 10 min | `src/lib/news.ts` |
| 60-word AI summarizer + fallback | `src/lib/summarize.ts` |
| Read article pages for full story text | `src/lib/article.ts` |
| Reports store (JSON file in `.data/`) | `src/lib/store.ts` |
| API routes | `src/app/api/{feed,report}/route.ts` |
| UI | `src/components/` (`App`, `NewsCard`, `Stories`, `Sheets`, `motion`, `icons`) |

- **Today tab:** masthead with the date and a count of new stories, a labelled Refresh button, Stories rings, topic tabs (For You, India, World, …), and a feed that always opens on the first story.
- **Stories:** "Top" (the most widely reported stories) plus one ring per topic. Tap a ring for full-screen slides: tap right for the next one, left to go back, hold to pause, drag down to close. Fully watched rings move to the end of the row, and reopening a ring resumes at its first unwatched story.
- **Stories without a photo** become text-only, with a larger headline and a small tinted topic icon.
- **About the source:** the story page has one line on who each outlet is (for example, Al Jazeera is an international news network based in Doha, Qatar). The lines live in `SOURCE_ABOUT` in `src/lib/client.ts`; add one whenever you add a source.
- **Full story page:** tap any card or search result. It shows the photo, headline, the 60-word summary, where the text came from, and a button to the full article.
- **Cards never scroll inside.** The photo shrinks to make room for the text. On very small screens the text fades out and a tap opens the full story.
- **Search tab:** search box, topic filter, and an inset list of results.
- **On each story:** share, and a ⋯ menu with copy link, show less of a topic, hide a source (both with Undo), and report.
- **Ads:** the card is labelled "Advertisement" and has its own colour and dashed border. There's at most one ad per 8 stories, and each ad sits in its own slot.
- **"You're All Caught Up":** this card marks where new stories end and stories you've already read begin.

## Name

NewsCrisp: the news, short and clear. On 10 Nov 2026 web searches found no app or site with this name; nearby names that are taken include NewsBit, NewsPeek, Newsfold and Newsbud. Domains have not been checked yet. Check newscrisp.com/.app/.in and run a trademark search before launch. The project folder is still called `newsreel`.

## Not done yet

- Comments, saved stories and a profile were removed from the UI for now.
- Likes. They were removed until there's a database. Vercel and similar hosts don't keep files, so the JSON store can't hold them.
- User accounts. Read history currently lives in the browser.
- Push notifications.
- A real database in place of the JSON file store.
- Better duplicate detection. It currently compares headline words only.
- Publisher licensing. Check each outlet's RSS terms before any commercial launch.
