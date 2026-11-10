"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

/** Apple-style spring parameters: damping ratio (1 = no overshoot) and response in seconds. */
export type Spring = { damping: number; response: number };

/** Default for anything a tap opens or closes: critically damped, no bounce. */
export const SMOOTH: Spring = { damping: 1, response: 0.4 };
/** Only after a flick or drag release, when the gesture itself carried momentum. */
export const MOMENTUM: Spring = { damping: 0.8, response: 0.3 };

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Where a flick would come to rest (Apple's scroll-deceleration projection). */
export function project(velocity: number, decelerationRate = 0.998) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Resistance that grows the further a drag goes past a boundary. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

const FADE_MS = 200;
const DRAG_SLOP = 10;

function capture(el: Element, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {
    /* the pointer already ended; tracking still works without capture */
  }
}

/**
 * A bottom sheet that springs in from below, follows the finger 1:1 when dragged down,
 * can be grabbed and reversed mid-flight, and leaves the way it came.
 * The scrim's opacity is tied to the sheet's position, so dimming tracks the drag too.
 */
export function useSheet(onClosed: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const st = useRef({ y: 0, v: 0, h: 1, raf: 0, timer: 0, target: 0, reduced: false, done: false });
  const drag = useRef<{
    id: number;
    originY: number;
    fromY: number;
    active: boolean;
    history: { t: number; y: number }[];
  } | null>(null);
  const suppressClick = useRef(false);
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  });

  const render = useCallback(() => {
    const s = st.current;
    const sheet = sheetRef.current;
    if (sheet) sheet.style.transform = `translate3d(0, ${s.y}px, 0)`;
    if (scrimRef.current) scrimRef.current.style.opacity = String(Math.min(1, Math.max(0, 1 - s.y / s.h)));
  }, []);

  const finish = useCallback(() => {
    const s = st.current;
    if (s.done) return;
    s.done = true;
    onClosedRef.current();
  }, []);

  /** Spring the sheet from wherever it is right now (its presentation value) to `target`. */
  const animateTo = useCallback(
    (target: number, spring: Spring, velocity?: number) => {
      const s = st.current;
      cancelAnimationFrame(s.raf);
      s.target = target;
      if (velocity !== undefined) s.v = velocity;
      const k = (2 * Math.PI / spring.response) ** 2;
      const c = (4 * Math.PI * spring.damping) / spring.response;
      let last = -1;
      const tick = (now: number) => {
        // rAF timestamps can predate this call, so the first frame steps one display frame.
        const dt = last < 0 ? 1 / 60 : Math.min(0.064, Math.max(0, (now - last) / 1000));
        last = now;
        const steps = Math.max(1, Math.ceil(dt / 0.004));
        const h = dt / steps;
        for (let i = 0; i < steps; i++) {
          s.v += (-k * (s.y - target) - c * s.v) * h;
          s.y += s.v * h;
        }
        if (target >= s.h && s.y >= s.h) {
          // Fully off screen: done, no need to wait out the settle.
          s.raf = 0;
          render();
          finish();
          return;
        }
        if (Math.abs(s.v) < 2 && Math.abs(s.y - target) < 0.5) {
          s.y = target;
          s.v = 0;
          s.raf = 0;
          render();
          if (target >= s.h) finish();
          return;
        }
        render();
        s.raf = requestAnimationFrame(tick);
      };
      s.raf = requestAnimationFrame(tick);
    },
    [render, finish],
  );

  /** Reduced motion: a short cross-fade in place of any slide. */
  const fade = useCallback(
    (to: 0 | 1) => {
      const s = st.current;
      const sheet = sheetRef.current;
      const scrim = scrimRef.current;
      for (const el of [sheet, scrim]) {
        if (!el) continue;
        el.style.transition = `opacity ${FADE_MS}ms ease`;
        el.style.opacity = String(to);
      }
      window.clearTimeout(s.timer);
      if (to === 0) s.timer = window.setTimeout(finish, FADE_MS);
    },
    [finish],
  );

  useLayoutEffect(() => {
    const s = st.current;
    const sheet = sheetRef.current;
    if (!sheet) return;
    s.reduced = prefersReducedMotion();
    s.h = Math.max(1, sheet.offsetHeight);
    if (s.reduced) {
      s.y = 0;
      render();
      sheet.style.opacity = "0";
      if (scrimRef.current) scrimRef.current.style.opacity = "0";
      requestAnimationFrame(() => fade(1));
    } else {
      s.y = s.h;
      render();
      animateTo(0, SMOOTH);
    }
    return () => {
      cancelAnimationFrame(s.raf);
      window.clearTimeout(s.timer);
    };
  }, [animateTo, fade, render]);

  const close = useCallback(() => {
    const s = st.current;
    if (sheetRef.current) s.h = Math.max(1, sheetRef.current.offsetHeight);
    if (s.reduced) fade(0);
    else animateTo(s.h, SMOOTH);
  }, [animateTo, fade]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || st.current.done) return;
    suppressClick.current = false;
    const s = st.current;
    const moving = s.raf !== 0 && s.y !== s.target;
    cancelAnimationFrame(s.raf); // grab it mid-flight, from where it is on screen
    s.raf = 0;
    if (!moving && sheetRef.current) s.h = Math.max(1, sheetRef.current.offsetHeight);
    drag.current = {
      id: e.pointerId,
      originY: e.clientY,
      fromY: s.y,
      active: moving, // already moving: track at once, no slop
      history: [{ t: e.timeStamp, y: e.clientY }],
    };
    if (moving) capture(e.currentTarget, e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const s = st.current;
    if (!d.active) {
      if (Math.abs(e.clientY - d.originY) < DRAG_SLOP) return;
      d.active = true;
      d.originY = e.clientY; // start 1:1 tracking from here so nothing jumps
      capture(e.currentTarget, e.pointerId);
    }
    const raw = d.fromY + (e.clientY - d.originY);
    s.y = raw < 0 ? -rubberband(-raw, s.h) : raw;
    render();
    d.history.push({ t: e.timeStamp, y: e.clientY });
    while (d.history.length > 2 && e.timeStamp - d.history[0].t > 80) d.history.shift();
  };

  const onPointerEnd = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const s = st.current;
    if (!d.active) {
      // A tap that interrupted nothing: leave things alone. One that stopped a spring: carry on.
      if (s.y !== s.target) animateTo(s.target, SMOOTH);
      return;
    }
    suppressClick.current = true;
    const first = d.history[0];
    const lastPt = d.history[d.history.length - 1];
    const dt = (lastPt.t - first.t) / 1000;
    const velocity = e.type === "pointercancel" || dt <= 0 ? 0 : (lastPt.y - first.y) / dt;
    const resting = s.y + project(velocity);
    const dismiss = resting > s.h * 0.5;
    if (s.reduced) {
      if (dismiss) fade(0);
      else animateTo(0, SMOOTH, 0);
      return;
    }
    animateTo(dismiss ? s.h : 0, MOMENTUM, velocity);
  };

  /** Spread onto the element people drag to dismiss (the whole sheet, or just its grabber bar). */
  const dragProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: onPointerEnd,
    onPointerCancel: onPointerEnd,
    onClickCapture: (e: React.MouseEvent) => {
      if (!suppressClick.current) return;
      suppressClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return { sheetRef, scrimRef, close, dragProps };
}
