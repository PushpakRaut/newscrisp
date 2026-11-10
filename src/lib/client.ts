"use client";

import { useEffect, useState } from "react";
import type { Category } from "./types";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** useState that remembers its value in this browser. */
export function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode or storage blocked: keep it in memory only */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export function getDeviceId(): string {
  let id = read<string | null>("nr.device", null);
  if (!id) {
    id = crypto.randomUUID();
    try {
      localStorage.setItem("nr.device", JSON.stringify(id));
    } catch {
      /* ignore */
    }
  }
  return id;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  india: "India",
  world: "World",
  business: "Business",
  technology: "Tech",
  sports: "Sports",
  entertainment: "Entertainment",
  science: "Science",
};

/** One line about each outlet, so readers know who is reporting. */
export const SOURCE_ABOUT: Record<string, string> = {
  "The Hindu": "an Indian national newspaper, published from Chennai since 1878",
  "Indian Express": "an Indian national newspaper known for investigative reporting",
  NDTV: "an Indian television news network based in New Delhi",
  BBC: "the UK’s public broadcaster, based in London",
  "BBC Sport": "the sports desk of the BBC, the UK’s public broadcaster",
  "Al Jazeera": "an international news network based in Doha, Qatar",
  Livemint: "the website of Mint, an Indian business newspaper",
  TechCrunch: "a US website covering startups and technology",
  ESPNcricinfo: "a cricket news site, part of ESPN",
};
