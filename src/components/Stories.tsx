"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Short } from "@/lib/types";
import { CATEGORY_LABEL, timeAgo } from "@/lib/client";
import { Photo, Thumb, TopicTile, usePhoto } from "./NewsCard";
import { ArrowUpRight, XMark } from "./icons";
import { prefersReducedMotion, useSheet } from "./motion";

export interface StoryGroup {
  key: string;
  label: string;
  shorts: Short[];
}

/** Reading time for one slide: long enough to read 60 words, never a slog. */
function slideMs(s: Short) {
  const words = (s.summary || s.headline).split(/\s+/).length + s.headline.split(/\s+/).length;
  return Math.min(14000, Math.max(6000, (words / 4.2) * 1000));
}

/**
 * The row of rings under the masthead. Rings with unwatched stories come first; once a ring is
 * fully watched it moves to the end. The move animates (FLIP), so rings slide rather than jump.
 */
export function StoryRings({
  groups,
  readSet,
  onOpen,
}: {
  groups: StoryGroup[];
  readSet: Set<string>;
  onOpen: (index: number) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const lastX = useRef(new Map<string, number>());
  const orderKey = groups.map((g) => g.key).join("|");

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const next = new Map<string, number>();
    const reduced = prefersReducedMotion();
    for (const el of row.querySelectorAll<HTMLElement>("[data-ring]")) {
      const key = el.dataset.ring!;
      const x = el.offsetLeft;
      next.set(key, x);
      const prev = lastX.current.get(key);
      if (reduced || prev === undefined || prev === x) continue;
      // Start from where it was on screen, then spring to the new place.
      el.style.transition = "none";
      el.style.transform = `translateX(${prev - x}px)`;
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.style.transform = "";
      });
    }
    lastX.current = next;
  }, [orderKey]);

  return (
    <div ref={rowRef} className="rings" role="list" aria-label="Stories">
      {groups.map((g, i) => {
        const unread = g.shorts.some((s) => !readSet.has(s.id));
        const cover = g.shorts.find((s) => s.image) ?? g.shorts[0];
        return (
          <button
            key={g.key}
            data-ring={g.key}
            role="listitem"
            className={`ring ${unread ? "unread" : ""}`}
            onClick={() => onOpen(i)}
            aria-label={`${g.label} stories`}
          >
            <span className="ring-art">
              <Thumb key={cover.id} short={cover} topic={g.key === "top" ? "top" : cover.category} />
            </span>
            <span className="ring-label">{g.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Full-screen Stories: tap right for next, left for back, hold to pause, drag down to close. */
export function StoriesViewer({
  groups,
  startGroup,
  readAtOpen,
  onSeen,
  onOpenStory,
  onClosed,
}: {
  groups: StoryGroup[];
  startGroup: number;
  /** What had been read when the viewer opened: each ring resumes at its first unwatched story. */
  readAtOpen: Set<string>;
  onSeen: (s: Short) => void;
  onOpenStory: (s: Short) => void;
  onClosed: () => void;
}) {
  const { sheetRef, scrimRef, close, dragProps } = useSheet(onClosed);
  const firstUnread = (g: number) => Math.max(0, groups[g].shorts.findIndex((s) => !readAtOpen.has(s.id)));
  const [pos, setPos] = useState(() => ({ g: startGroup, i: firstUnread(startGroup), n: 0 }));
  const [held, setHeld] = useState(false);
  const pressAt = useRef(0);

  const group = groups[pos.g];
  const short = group?.shorts[pos.i];
  const photo = usePhoto(short ?? groups[0].shorts[0]);

  useEffect(() => {
    if (short) onSeen(short);
  }, [short, onSeen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Each move bumps `n`, so going back to the same slide restarts its progress bar.
  function next() {
    const g = groups[pos.g];
    if (pos.i + 1 < g.shorts.length) setPos({ g: pos.g, i: pos.i + 1, n: pos.n + 1 });
    else if (pos.g + 1 < groups.length) setPos({ g: pos.g + 1, i: firstUnread(pos.g + 1), n: pos.n + 1 });
    else close();
  }
  function prev() {
    if (pos.i > 0) setPos({ g: pos.g, i: pos.i - 1, n: pos.n + 1 });
    else if (pos.g > 0) setPos({ g: pos.g - 1, i: groups[pos.g - 1].shorts.length - 1, n: pos.n + 1 });
    else setPos({ g: pos.g, i: 0, n: pos.n + 1 });
  }

  if (!group || !short) return null;

  return (
    <div className="sheet-layer">
      <div ref={scrimRef} className="scrim stories-scrim" aria-hidden />
      <div
        ref={sheetRef}
        className={`stories ${photo.has ? "" : "no-photo"}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${group.label} stories`}
        {...dragProps}
        onPointerDown={(e) => {
          dragProps.onPointerDown(e);
          pressAt.current = e.timeStamp;
          setHeld(true);
        }}
        onPointerUp={(e) => {
          dragProps.onPointerUp(e);
          setHeld(false);
        }}
        onPointerCancel={(e) => {
          dragProps.onPointerCancel(e);
          setHeld(false);
        }}
      >
        {photo.has ? (
          <div className="stories-media">
            <Photo key={short.id} short={short} onError={photo.onError} />
          </div>
        ) : (
          <div className={`stories-glow t-${short.category}`} aria-hidden />
        )}

        <div className="stories-top">
          <div className="stories-bars" aria-hidden>
            {group.shorts.map((s, i) => (
              <span key={s.id} className="stories-bar">
                <span
                  key={i === pos.i ? `now-${pos.n}` : `idle-${i}`}
                  className={`stories-fill ${i < pos.i ? "done" : i === pos.i ? "now" : ""}`}
                  style={i === pos.i ? { animationDuration: `${slideMs(s)}ms`, animationPlayState: held ? "paused" : "running" } : undefined}
                  onAnimationEnd={i === pos.i ? next : undefined}
                />
              </span>
            ))}
          </div>
          <div className="stories-head">
            <span className="stories-topic">{group.label}</span>
            <span className="stories-time">{timeAgo(short.publishedAt)}</span>
            <span className="spacer" />
            <button
              className="stories-close"
              aria-label="Close stories"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={close}
            >
              <XMark size={18} />
            </button>
          </div>
        </div>

        {/* Tap zones: left third goes back, the rest goes forward. Long presses only pause. */}
        <div
          className="stories-tap"
          onClick={(e) => {
            if (e.timeStamp - pressAt.current > 350) return;
            const r = e.currentTarget.getBoundingClientRect();
            if (e.clientX - r.left < r.width / 3) prev();
            else next();
          }}
        />

        <div className="stories-copy">
          {!photo.has && <TopicTile topic={short.category} size={26} className="stories-tile" />}
          <p className="stories-kicker">
            {CATEGORY_LABEL[short.category]} · {short.source}
          </p>
          <h2 className="stories-headline">{short.headline}</h2>
          {short.summary && <p className="stories-summary">{short.summary}</p>}
          <button
            className="stories-cta"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              onOpenStory(short);
              close();
            }}
          >
            Open story <ArrowUpRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
