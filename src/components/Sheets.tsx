"use client";

import { useEffect, useState, type ReactNode } from "react";
import { REPORT_REASONS, type Edition, type Short } from "@/lib/types";
import { CATEGORY_LABEL, SOURCE_ABOUT } from "@/lib/client";
import { SOURCES } from "@/lib/sources";
import { useSheet } from "./motion";

function useEscape(onEscape: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onEscape();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}

/**
 * iOS-style action sheet: a grouped list of actions plus a separate Cancel button.
 * Drag it down to dismiss; every way out animates back down the path it came in on.
 */
export function MenuSheet({
  short,
  onClosed,
  allowReport = true,
  onMuteSource,
  onLessCategory,
  onReport,
  onCopy,
}: {
  short: Short;
  onClosed: () => void;
  /** Off in the public edition, which has no database to keep reports in. */
  allowReport?: boolean;
  onMuteSource: (source: string) => void;
  onLessCategory: (s: Short) => void;
  onReport: (s: Short, reason: string) => void;
  onCopy: (s: Short) => void;
}) {
  const [reporting, setReporting] = useState(false);
  const { sheetRef, scrimRef, close, dragProps } = useSheet(onClosed);
  useEscape(close);

  // The action takes effect at once; the sheet leaves while it does.
  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <div className="sheet-layer">
      <div ref={scrimRef} className="scrim" onClick={close} aria-hidden />
      <div
        ref={sheetRef}
        className="action-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={reporting ? "Report this story" : "Story options"}
        {...dragProps}
      >
        <div className="action-group">
          <div className="action-title">{reporting ? "What’s wrong with this story?" : short.headline}</div>
          {reporting ? (
            REPORT_REASONS.map((r) => (
              <button key={r.id} className="action" onClick={run(() => onReport(short, r.id))}>
                {r.label}
              </button>
            ))
          ) : (
            <>
              <button className="action" onClick={run(() => onCopy(short))}>
                Copy Link
              </button>
              <button className="action" onClick={run(() => onLessCategory(short))}>
                Show Less {CATEGORY_LABEL[short.category]}
              </button>
              <button className="action" onClick={run(() => onMuteSource(short.source))}>
                Hide Stories from {short.source}
              </button>
              {allowReport && (
                <button className="action" onClick={() => setReporting(true)}>
                  Report a Problem…
                </button>
              )}
            </>
          )}
        </div>
        <div className="action-group">
          <button className="action cancel" onClick={close}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** A full story opened from Search: a card sheet you can pull down by its top bar, or close with Done. */
export function StorySheet({ onClosed, children }: { onClosed: () => void; children: ReactNode }) {
  const { sheetRef, scrimRef, close, dragProps } = useSheet(onClosed);
  useEscape(close);

  return (
    <div className="sheet-layer">
      <div ref={scrimRef} className="scrim" onClick={close} aria-hidden />
      <div ref={sheetRef} className="story-sheet" role="dialog" aria-modal="true" aria-label="Story">
        <div className="story-sheet-bar" {...dragProps}>
          <span className="grabber" aria-hidden />
          <button className="text-btn" onClick={close}>
            Done
          </button>
        </div>
        <div className="story-sheet-card">{children}</div>
      </div>
    </div>
  );
}

const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

/** Where the stories come from, what NewsCrisp does and doesn't do with them, and privacy. */
export function AboutSheet({ edition, onClosed }: { edition: Edition; onClosed: () => void }) {
  const outlets = [...new Set(SOURCES.map((s) => s.name))];
  return (
    <StorySheet onClosed={onClosed}>
      <article className="about">
        <p className="story-page-kicker">About</p>
        <h1 className="story-page-headline">NewsCrisp</h1>
        <hr className="rule" />
        <p className="about-disclaimer" role="note">
          <strong>Personal project.</strong> NewsCrisp is a personal, non-commercial project. It doesn’t sell anything,
          show real ads or earn money, and isn’t affiliated with any news outlet. All news content belongs to its
          publishers.
        </p>
        {edition === "public" ? (
          <p className="about-lead">
            NewsCrisp shows the headlines and short descriptions that news outlets publish in their public RSS feeds.
            Every story names its outlet and links to the full article on the outlet’s own site. NewsCrisp doesn’t copy
            articles or photos, doesn’t rewrite them with AI, and isn’t affiliated with any of these outlets.
          </p>
        ) : (
          <p className="about-lead">
            This is the private edition of NewsCrisp. It reads each article’s page to build longer summaries and shows
            publisher photos, so it isn’t meant to be shared publicly.
          </p>
        )}

        <h2 className="about-head">Sources</h2>
        <ul className="about-list">
          {outlets.map((name) => (
            <li key={name}>
              <strong>{name}</strong>
              {SOURCE_ABOUT[name] ? `: ${SOURCE_ABOUT[name]}` : ""}
            </li>
          ))}
        </ul>

        <h2 className="about-head">Your privacy</h2>
        <p className="about-text">
          No account, no ads and no tracking. The stories you’ve read and the sources you’ve hidden are kept only in
          this browser on this device.
        </p>

        {CONTACT && (
          <>
            <h2 className="about-head">For publishers</h2>
            <p className="about-text">
              To have your feed removed or a story corrected, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </>
        )}
      </article>
    </StorySheet>
  );
}
