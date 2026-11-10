"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, type Category, type FeedResponse, type Short } from "@/lib/types";
import { CATEGORY_LABEL, getDeviceId, timeAgo, useLocal } from "@/lib/client";
import { CaughtUpCard, NewsCard, SponsoredCard, StoryPage, Thumb, type CardActions } from "./NewsCard";
import { StoriesViewer, StoryRings, type StoryGroup } from "./Stories";
import { AboutSheet, MenuSheet, StorySheet } from "./Sheets";
import { prefersReducedMotion } from "./motion";
import { Check, Info, Newspaper, Refresh, Search, XMark } from "./icons";

type Tab = "today" | "search";
type Topic = "foryou" | Category;
type Toast = { id: number; text: string; undo?: () => void; leaving?: boolean };
type FeedItem = { kind: "short"; id: string } | { kind: "ad"; key: string } | { kind: "caught" };

const AD_EVERY = 8;

async function getFeed(): Promise<FeedResponse> {
  const res = await fetch("/api/feed", { cache: "no-store" });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return (await res.json()) as FeedResponse;
}

/** Order the feed once per load or topic change, so cards don't jump around while you read. */
function buildOrder(
  shorts: Short[],
  read: Set<string>,
  lessCats: Partial<Record<Category, number>>,
  ads: boolean,
): FeedItem[] {
  const affinity: Record<string, number> = {};
  for (const c of CATEGORIES) affinity[c] = Math.max(0.1, 1 - 0.7 * (lessCats[c] ?? 0));

  const now = Date.now();
  const score = (s: Short) => affinity[s.category] * Math.exp(-(now - Date.parse(s.publishedAt)) / 3_600_000 / 18);
  const unread = shorts.filter((s) => !read.has(s.id)).sort((a, b) => score(b) - score(a));
  const seen = shorts.filter((s) => read.has(s.id)).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const items: FeedItem[] = [];
  let count = 0;
  const push = (s: Short) => {
    items.push({ kind: "short", id: s.id });
    count++;
    if (ads && count % AD_EVERY === 0) items.push({ kind: "ad", key: `ad-${count}` });
  };
  unread.forEach(push);
  if (shorts.length) items.push({ kind: "caught" });
  seen.forEach(push);
  return items;
}

export default function App() {
  const [data, setData] = useState<FeedResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<FeedItem[]>([]);
  const [today] = useState(() =>
    new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
  );

  const [read, setRead] = useLocal<string[]>("fg.read", []);
  const [mutedSources, setMutedSources] = useLocal<string[]>("fg.mutedSources", []);
  const [lessCats, setLessCats] = useLocal<Partial<Record<Category, number>>>("fg.lessCats", {});

  const [tab, setTab] = useState<Tab>("today");
  const [topic, setTopic] = useState<Topic>("foryou");
  const [menuFor, setMenuFor] = useState<Short | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [query, setQuery] = useState("");
  const [searchTopic, setSearchTopic] = useState<Category | null>(null);
  const [focus, setFocus] = useState<Short | null>(null);
  const [viewer, setViewer] = useState<{ groups: StoryGroup[]; start: number; read: Set<string> } | null>(null);
  const [justUpdated, setJustUpdated] = useState(false);
  const [about, setAbout] = useState(false);

  // The server says which edition it runs; until it answers, assume the public one.
  const edition = data?.edition ?? "public";
  const isPublic = edition === "public";

  const feedRef = useRef<HTMLDivElement>(null);

  const readSet = useMemo(() => new Set(read), [read]);

  const visible = useMemo(
    () => (data?.shorts ?? []).filter((s) => !mutedSources.includes(s.source)),
    [data, mutedSources],
  );
  const inTopic = useMemo(
    () => (topic === "foryou" ? visible : visible.filter((s) => s.category === topic)),
    [visible, topic],
  );
  const byId = useMemo(() => new Map((data?.shorts ?? []).map((s) => [s.id, s])), [data]);
  const newCount = inTopic.filter((s) => !readSet.has(s.id)).length;
  const topics = useMemo(() => CATEGORIES.filter((c) => visible.some((s) => s.category === c)), [visible]);

  // Never restore an old scroll position: the app always opens on the first story.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    // iOS Safari only applies :active on touch-down when a touch listener exists; feedback belongs on the press.
    const noop = () => {};
    document.addEventListener("touchstart", noop, { passive: true });
    return () => document.removeEventListener("touchstart", noop);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToast((t) => (t?.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 260);
  }, []);
  const showToast = useCallback(
    (text: string, undo?: () => void) => {
      const id = Date.now();
      setToast({ id, text, undo });
      setTimeout(() => dismissToast(id), undo ? 4000 : 2200);
    },
    [dismissToast],
  );

  const applyFeed = useCallback((d: FeedResponse) => {
    setData(d);
    setLoadError(null);
    setLoading(false);
  }, []);
  const failFeed = useCallback((err: unknown) => {
    setLoadError(err instanceof Error ? err.message : "Couldn’t load the news");
    setLoading(false);
  }, []);

  const load = () => {
    if (loading) return;
    setLoading(true);
    setLoadError(null);
    const before = new Set((data?.shorts ?? []).map((s) => s.id));
    getFeed()
      .then((d) => {
        applyFeed(d);
        if (!data) return;
        // Completion feedback: say what the refresh found, and tick the button briefly.
        const fresh = d.shorts.filter((s) => !before.has(s.id)).length;
        showToast(fresh ? `${fresh} new ${fresh === 1 ? "story" : "stories"}` : "You’re up to date");
        setJustUpdated(true);
        setTimeout(() => setJustUpdated(false), 1600);
      })
      .catch((err) => {
        failFeed(err);
        // With stories already on screen the error state is hidden, so say so out loud.
        if (data) showToast("Couldn’t refresh. Try again in a moment.");
      });
  };

  useEffect(() => {
    getFeed().then(applyFeed).catch(failFeed);
  }, [applyFeed, failFeed]);

  // Rebuild the order only when new data arrives or the topic/preferences change.
  const orderInputs = useRef({ read: readSet });
  useEffect(() => {
    orderInputs.current = { read: readSet };
  });
  useEffect(() => {
    const i = orderInputs.current;
    setOrder(buildOrder(inTopic, i.read, lessCats, !isPublic));
  }, [inTopic, lessCats, isPublic]);

  // A fresh order always starts at the first story, with nothing above it.
  useLayoutEffect(() => {
    feedRef.current?.scrollTo({ top: 0 });
  }, [order]);

  const markRead = useCallback(
    (s: Short) => setRead((prev) => (prev.includes(s.id) ? prev : [...prev, s.id].slice(-1500))),
    [setRead],
  );

  const actions: CardActions = {
    onShare: async (s) => {
      // The public edition shares only the headline and the link, not the publisher's text.
      const text = isPublic ? `${s.headline} (via ${s.source})` : `${s.headline}\n\n${s.summary}\n\nvia ${s.source}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: s.headline, text, url: s.link });
          return;
        }
        await navigator.clipboard.writeText(`${text}\n${s.link}`);
        showToast("Copied");
      } catch {
        /* share sheet dismissed */
      }
    },
    onMenu: (s) => setMenuFor(s),
    onOpen: (s) => setFocus(s),
    onSeen: markRead,
  };

  const cardProps = (s: Short) => ({
    short: s,
    read: readSet.has(s.id),
    ...actions,
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = visible;
    if (searchTopic) list = list.filter((s) => s.category === searchTopic);
    if (q) list = list.filter((s) => `${s.headline} ${s.summary} ${s.source}`.toLowerCase().includes(q));
    return list.slice(0, 60);
  }, [visible, query, searchTopic]);

  // Stories: "Top" holds the most widely reported stories, then one ring per topic, newest first.
  // Each ring's stories stay fixed between refreshes, so a ring can be fully watched.
  // Unwatched rings come first; watched ones move to the end.
  const storyGroups = useMemo<StoryGroup[]>(() => {
    const newest = (list: Short[]) => [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    const top = [...visible]
      .sort((a, b) => b.alsoCoveredBy.length - a.alsoCoveredBy.length || b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 6);
    const groups: StoryGroup[] = [{ key: "top", label: "Top", shorts: top }];
    for (const c of topics) groups.push({ key: c, label: CATEGORY_LABEL[c], shorts: newest(visible.filter((s) => s.category === c)).slice(0, 5) });
    const live = groups.filter((g) => g.shorts.length > 0);
    const watched = (g: StoryGroup) => g.shorts.every((s) => readSet.has(s.id));
    return [...live.filter((g) => !watched(g)), ...live.filter(watched)];
  }, [visible, topics, readSet]);

  const goToday = () => {
    if (tab === "today") feedRef.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    else setTab("today");
  };

  return (
    <div className={`app edition-${edition}`}>
      {tab === "today" ? (
        <header className="nav-bar">
          <div className="masthead">
            <div className="masthead-text">
              <p className="nav-date" aria-live="polite">
                {today}
                {data && (
                  <span className="nav-count">
                    {" · "}
                    {loading ? "Updating…" : newCount === 0 ? "Up to date" : `${newCount} new`}
                  </span>
                )}
              </p>
              <h1 className="wordmark">NewsCrisp</h1>
            </div>
            <button className="round-btn info-btn" onClick={() => setAbout(true)} aria-label="About NewsCrisp and its sources">
              <Info size={18} />
            </button>
            <button
              className={`refresh-btn ${loading ? "busy" : ""} ${justUpdated ? "done" : ""}`}
              onClick={load}
              aria-busy={loading}
              aria-label={loading ? "Refreshing" : "Refresh stories"}
            >
              <span className={`refresh-icon ${loading ? "spin" : ""}`}>{justUpdated ? <Check size={16} /> : <Refresh size={16} />}</span>
              <span>{loading ? "Updating" : justUpdated ? "Updated" : "Refresh"}</span>
            </button>
          </div>
          {storyGroups.length > 0 && (
            <StoryRings groups={storyGroups} readSet={readSet} onOpen={(i) => setViewer({ groups: storyGroups, start: i, read: new Set(readSet) })} />
          )}
          <div className="topics" role="tablist" aria-label="Topics">
            {(["foryou", ...topics] as Topic[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={topic === t}
                className={`topic ${topic === t ? "on" : ""}`}
                onClick={() => setTopic(t)}
              >
                {t === "foryou" ? "For You" : CATEGORY_LABEL[t]}
              </button>
            ))}
          </div>
        </header>
      ) : (
        <header className="nav-bar">
          <div className="masthead">
            <div className="masthead-text">
              <p className="nav-date">{visible.length} stories today</p>
              <h1 className="wordmark">Search</h1>
            </div>
          </div>
          <label className="search-field">
            <Search size={17} strokeWidth={2.2} />
            <input
              type="search"
              placeholder="Stories, topics, sources"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search stories"
            />
            {query && (
              <button className="clear-btn" onClick={() => setQuery("")} aria-label="Clear search">
                <XMark size={10} />
              </button>
            )}
          </label>
          <div className="topics">
            <button className={`topic ${searchTopic === null ? "on" : ""}`} onClick={() => setSearchTopic(null)}>
              All
            </button>
            {topics.map((c) => (
              <button key={c} className={`topic ${searchTopic === c ? "on" : ""}`} onClick={() => setSearchTopic(c)}>
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </header>
      )}

      <main className="main">
        {tab === "today" && (
          <div className="feed" ref={feedRef}>
            {!data && loading && (
              <div className="state">
                <span className="spin">
                  <Refresh size={24} />
                </span>
                Getting today’s stories…
              </div>
            )}
            {!data && loadError && (
              <div className="state">
                <p>Couldn’t load the news. {loadError}</p>
                <button className="tinted-btn" onClick={load}>Try Again</button>
              </div>
            )}
            {data && inTopic.length === 0 && (
              <div className="state">
                <p>No stories here right now.</p>
                <button className="tinted-btn" onClick={load}>Try Again</button>
              </div>
            )}
            {order.map((item) => {
              if (item.kind === "ad")
                return (
                  <section className="slot" key={item.key}>
                    <SponsoredCard />
                  </section>
                );
              if (item.kind === "caught")
                return (
                  <section className="slot" key="caught">
                    <CaughtUpCard onSearch={() => setTab("search")} />
                  </section>
                );
              const s = byId.get(item.id);
              if (!s || mutedSources.includes(s.source)) return null;
              return (
                <section className="slot" key={s.id}>
                  <NewsCard {...cardProps(s)} />
                </section>
              );
            })}
          </div>
        )}

        {tab === "search" && (
          <div className="page">
            {results.length === 0 ? (
              <p className="empty">No stories match.</p>
            ) : (
              <ul className="inset-list">
                {results.map((s) => (
                  <li key={s.id}>
                    <button className="list-row" onClick={() => setFocus(s)}>
                      <Thumb short={s} className="list-thumb" />
                      <span className="list-text">
                        <span className="list-eyebrow">
                          {CATEGORY_LABEL[s.category]} · {s.source} · {timeAgo(s.publishedAt)}
                        </span>
                        <span className="list-title">{s.headline}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      <nav className="tab-bar" aria-label="Main">
        <button className={tab === "today" ? "on" : ""} onClick={goToday}>
          <Newspaper filled={tab === "today"} />
          <span>Today</span>
        </button>
        <button className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>
          <Search strokeWidth={2.1} />
          <span>Search</span>
        </button>
      </nav>

      {focus && (
        <StorySheet key={focus.id} onClosed={() => setFocus(null)}>
          <StoryPage {...cardProps(byId.get(focus.id) ?? focus)} />
        </StorySheet>
      )}

      {viewer && (
        <StoriesViewer
          groups={viewer.groups}
          startGroup={viewer.start}
          readAtOpen={viewer.read}
          onSeen={markRead}
          onOpenStory={(s) => setFocus(s)}
          onClosed={() => setViewer(null)}
        />
      )}

      {about && <AboutSheet edition={edition} onClosed={() => setAbout(false)} />}

      {menuFor && (
        <MenuSheet
          key={menuFor.id}
          short={menuFor}
          onClosed={() => setMenuFor(null)}
          allowReport={!isPublic}
          onMuteSource={(src) => {
            setMutedSources((m) => [...new Set([...m, src])]);
            showToast(`Hiding ${src}`, () => setMutedSources((m) => m.filter((x) => x !== src)));
          }}
          onLessCategory={(s) => {
            setLessCats((l) => ({ ...l, [s.category]: (l[s.category] ?? 0) + 1 }));
            showToast(`Showing less ${CATEGORY_LABEL[s.category]}`, () =>
              setLessCats((l) => ({ ...l, [s.category]: Math.max(0, (l[s.category] ?? 0) - 1) })),
            );
          }}
          onReport={(s, reason) => {
            fetch("/api/report", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ shortId: s.id, reason, device: getDeviceId() }),
            }).catch(() => {});
            showToast("Thanks for the report");
          }}
          onCopy={async (s) => {
            try {
              await navigator.clipboard.writeText(s.link);
              showToast("Link Copied");
            } catch {
              showToast("Couldn’t copy the link");
            }
          }}
        />
      )}

      {toast && (
        <div key={toast.id} className={`hud ${toast.leaving ? "out" : ""}`} role="status">
          <span>{toast.text}</span>
          {toast.undo && !toast.leaving && (
            <button
              className="hud-undo"
              onClick={() => {
                toast.undo?.();
                dismissToast(toast.id);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
