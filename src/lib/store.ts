import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Tiny JSON-file store for story reports (full edition only).
 * shortcut: one file on one server; move to a real database before running on a host that doesn't keep files.
 */
type Report = { shortId: string; reason: string; device: string; at: string };

const FILE = path.join(process.cwd(), ".data", "store.json");
let reports: Report[] | null = null;
let writing: Promise<void> = Promise.resolve();

async function load(): Promise<Report[]> {
  if (reports) return reports;
  try {
    reports = (JSON.parse(await fs.readFile(FILE, "utf8")) as { reports?: Report[] }).reports ?? [];
  } catch {
    reports = [];
  }
  return reports;
}

function save() {
  // catch first: one failed write must not leave the chain rejected and skip every later write
  writing = writing
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(path.dirname(FILE), { recursive: true });
      await fs.writeFile(FILE, JSON.stringify({ reports }));
    });
  return writing;
}

export async function addReport(shortId: string, reason: string, device: string) {
  (await load()).push({ shortId, reason, device, at: new Date().toISOString() });
  await save();
}
