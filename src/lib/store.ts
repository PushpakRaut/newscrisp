import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Comment } from "./types";

/**
 * Tiny JSON-file store for likes, comments and reports. Good enough for an
 * MVP on one server; swap for Postgres/Redis before real users arrive.
 */
interface Data {
  likes: Record<string, string[]>; // shortId -> device ids
  comments: Comment[];
  reports: { shortId: string; reason: string; device: string; at: string }[];
}

const FILE = path.join(process.cwd(), ".data", "store.json");
let data: Data | null = null;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<Data> {
  if (data) return data;
  try {
    data = JSON.parse(await fs.readFile(FILE, "utf8")) as Data;
  } catch {
    data = { likes: {}, comments: [], reports: [] };
  }
  return data;
}

function save() {
  writing = writing.then(async () => {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(data));
  });
  return writing;
}

export async function counts(ids: string[]) {
  const d = await load();
  const likes: Record<string, number> = {};
  const comments: Record<string, number> = {};
  for (const id of ids) {
    likes[id] = d.likes[id]?.length ?? 0;
    comments[id] = 0;
  }
  for (const c of d.comments) if (c.shortId in comments) comments[c.shortId]++;
  return { likes, comments };
}

export async function setLike(shortId: string, device: string, on: boolean) {
  const d = await load();
  const set = new Set(d.likes[shortId] ?? []);
  if (on) set.add(device);
  else set.delete(device);
  d.likes[shortId] = [...set];
  await save();
  return set.size;
}

export async function listComments(shortId: string) {
  const d = await load();
  return d.comments.filter((c) => c.shortId === shortId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addComment(shortId: string, handle: string, text: string) {
  const d = await load();
  const c: Comment = { id: randomUUID(), shortId, handle, text, createdAt: new Date().toISOString() };
  d.comments.push(c);
  await save();
  return c;
}

export async function addReport(shortId: string, reason: string, device: string) {
  const d = await load();
  d.reports.push({ shortId, reason, device, at: new Date().toISOString() });
  await save();
}
