"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Short } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/client";
import { useSheet } from "./motion";

const REPORT_REASONS: { id: string; label: string }[] = [
  { id: "wrong-facts", label: "Facts Are Wrong" },
  { id: "misleading-headline", label: "Misleading Headline" },
  { id: "duplicate", label: "Already Seen This Story" },
  { id: "opinion-not-news", label: "Opinion or Clickbait" },
  { id: "offensive", label: "Offensive" },
  { id: "other", label: "Something Else" },
];

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
  onMuteSource,
  onLessCategory,
  onReport,
  onCopy,
}: {
  short: Short;
  onClosed: () => void;
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
              <button className="action" onClick={() => setReporting(true)}>
                Report a Problem…
              </button>
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
