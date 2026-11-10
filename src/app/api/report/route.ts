import { IS_PUBLIC } from "@/lib/edition";
import { addReport } from "@/lib/store";
import { REPORT_REASONS } from "@/lib/types";

const REASONS = new Set<string>(REPORT_REASONS.map((r) => r.id));

export async function POST(request: Request) {
  // The public edition has no database, so it doesn't accept reports.
  if (IS_PUBLIC) return Response.json({ error: "Reports are not available in this edition" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as { shortId?: string; reason?: string; device?: string } | null;
  if (!body?.shortId || !body.device || !body.reason || !REASONS.has(body.reason)) {
    return Response.json({ error: "shortId, device and a valid reason are required" }, { status: 400 });
  }
  await addReport(body.shortId, body.reason, body.device);
  return Response.json({ ok: true });
}
