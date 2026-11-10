"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Short } from "@/lib/types";
import { CATEGORY_LABEL, SOURCE_ABOUT, timeAgo } from "@/lib/client";
import { ArrowUpRight, Ellipsis, Share, TopicIcon } from "./icons";

export interface CardActions {
  onShare: (s: Short) => void;
  onMenu: (s: Short) => void;
  onOpen?: (s: Short) => void;
  onSeen?: (s: Short) => void;
}

interface Props extends CardActions {
  short: Short;
  read: boolean;
}

/** Whether a story has a usable photo. Flips to false if the image fails to load. */
export function usePhoto(short: Short) {
  const [failed, setFailed] = useState<string | null>(null);
  return { has: !!short.image && failed !== short.image, onError: () => setFailed(short.image) };
}

export function Photo({ short, onError }: { short: Short; onError: () => void }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={short.image ?? ""} alt="" loading="lazy" referrerPolicy="no-referrer" onError={onError} />;
}

/** A softly tinted topic icon: shown in place of a missing photo, never a block of colour with text on it. */
export function TopicTile({ topic, size = 22, className = "" }: { topic: string; size?: number; className?: string }) {
  return (
    <span className={`topic-tile t-${topic} ${className}`} aria-hidden>
      <TopicIcon topic={topic} size={size} />
    </span>
  );
}

/** Photo if there is one, otherwise the topic tile. Used for story rings and search thumbnails. */
export function Thumb({ short, topic, className = "" }: { short: Short; topic?: string; className?: string }) {
  const photo = usePhoto(short);
  return photo.has ? (
    <span className={`thumb ${className}`}>
      <Photo short={short} onError={photo.onError} />
    </span>
  ) : (
    <TopicTile topic={topic ?? short.category} className={`thumb ${className}`} />
  );
}

export function Kicker({ short, time = true }: { short: Short; time?: boolean }) {
  return (
    <p className="kicker">
      <span className="kicker-cat">{CATEGORY_LABEL[short.category]}</span>
      <span className="kicker-sep" aria-hidden>
        ·
      </span>
      <span>{short.source}</span>
      {time && (
        <>
          <span className="kicker-sep" aria-hidden>
            ·
          </span>
          <time dateTime={short.publishedAt}>{timeAgo(short.publishedAt)}</time>
        </>
      )}
    </p>
  );
}

/** Share and more: the same row on the card and on the full story page. */
export function StoryActions({
  short,
  onShare,
  onMenu,
  trailing,
}: Pick<Props, "short" | "onShare" | "onMenu"> & { trailing?: ReactNode }) {
  return (
    <div className="story-actions">
      <button className="round-btn" onClick={() => onShare(short)} aria-label="Share">
        <Share />
      </button>
      <button className="round-btn" onClick={() => onMenu(short)} aria-label="More options">
        <Ellipsis />
      </button>
      <span className="spacer" />
      {trailing}
    </div>
  );
}

export function NewsCard({ short, read, ...a }: Props) {
  const ref = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState(false);
  const photo = usePhoto(short);
  const onSeen = a.onSeen;

  // Count a short as read once it has been on screen for a moment.
  useEffect(() => {
    const el = ref.current;
    if (!el || !onSeen || read) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) timer = setTimeout(() => onSeen(short), 1200);
        else clearTimeout(timer);
      },
      { threshold: 0.7 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearTimeout(timer);
    };
  }, [onSeen, read, short]);

  // The text never scrolls. The photo gives up space first; if the text still doesn't fit
  // (small screen, very large text size), it fades out and a tap opens the full story.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => setClipped(el.scrollHeight - el.clientHeight > 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [short, photo.has]);

  const open = () => a.onOpen?.(short);

  return (
    <article ref={ref} className={`card ${photo.has ? "" : "no-photo"}`} id={`short-${short.id}`}>
      <div
        className="card-hit"
        role="button"
        tabIndex={0}
        aria-label={`Open story: ${short.headline}`}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
      >
        {photo.has && (
          <div className="card-media">
            <Photo short={short} onError={photo.onError} />
          </div>
        )}
        <div ref={textRef} className={`card-text ${clipped ? "clipped" : ""}`}>
          {!photo.has && <TopicTile topic={short.category} className="card-tile" />}
          <Kicker short={short} />
          <h2 className="card-headline">{short.headline}</h2>
          {short.summary ? (
            <p className="card-summary">{short.summary}</p>
          ) : (
            <p className="card-summary faint">{short.source} shared only the headline. Tap for the link to the full story.</p>
          )}
        </div>
      </div>

      <footer className="card-footer">
        <StoryActions
          short={short}
          onShare={a.onShare}
          onMenu={a.onMenu}
          trailing={
            <a className="read-link" href={short.link} target="_blank" rel="noopener noreferrer">
              {short.source} <ArrowUpRight />
            </a>
          }
        />
      </footer>
    </article>
  );
}

/** Full story page, opened by tapping a card, a search result or a Stories slide. */
export function StoryPage({ short, ...a }: Omit<Props, "read">) {
  const photo = usePhoto(short);
  const about = SOURCE_ABOUT[short.source];
  const provenance =
    short.summaryBy === "ai"
      ? `Summary written by AI from ${short.source}’s report. Read the full article for details and quotes.`
      : short.summaryBy === "article"
        ? `Opening lines of ${short.source}’s article. Read the full article for the rest of the story.`
        : `Description from ${short.source}’s news feed. Read the full article for the whole story.`;
  return (
    <article className={`story-page ${photo.has ? "" : "no-photo"}`}>
      {photo.has && (
        <div className="story-page-media">
          <Photo short={short} onError={photo.onError} />
        </div>
      )}
      <div className="story-page-body">
        {!photo.has && <TopicTile topic={short.category} size={26} className="story-page-tile" />}
        <p className="story-page-kicker">{CATEGORY_LABEL[short.category]}</p>
        <h1 className="story-page-headline">{short.headline}</h1>
        <p className="story-page-byline">
          {short.source} · <time dateTime={short.publishedAt}>{timeAgo(short.publishedAt)}</time>
        </p>
        <hr className="rule" />
        {short.summary ? (
          <p className="story-page-summary">{short.summary}</p>
        ) : (
          <p className="story-page-summary faint">{short.source} only shared a headline for this one.</p>
        )}
        <p className="story-page-note">{provenance}</p>
        {about && (
          <p className="story-page-note">
            About the source: {short.source} is {about}.
          </p>
        )}
        {short.alsoCoveredBy.length > 0 && (
          <p className="story-page-note">Also reported by {short.alsoCoveredBy.join(", ")}.</p>
        )}
        <a className="primary-btn" href={short.link} target="_blank" rel="noopener noreferrer">
          Read the full article on {short.source} <ArrowUpRight size={16} />
        </a>
        <StoryActions short={short} onShare={a.onShare} onMenu={a.onMenu} />
      </div>
    </article>
  );
}

export function SponsoredCard() {
  return (
    <article className="card sponsored" aria-label="Advertisement">
      <p className="sponsored-tag">Advertisement</p>
      <div className="sponsored-body">
        <div className="sponsored-mark" aria-hidden>
          ◎
        </div>
        <h2>Your brand here</h2>
        <p>Ads on NewsCrisp always say they’re ads, look different from news, and appear at most once every eight stories.</p>
        <button className="filled-btn" type="button">
          Learn More
        </button>
      </div>
    </article>
  );
}

export function CaughtUpCard({ onSearch }: { onSearch: () => void }) {
  return (
    <article className="card caught-up">
      <div className="caught-up-check" aria-hidden>
        <svg viewBox="0 0 52 52" width="56" height="56">
          <circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2>You’re all caught up</h2>
      <p>That’s every new story. Keep scrolling for ones you’ve already read, or check back later.</p>
      <button className="tinted-btn" onClick={onSearch}>
        Search older stories
      </button>
    </article>
  );
}
