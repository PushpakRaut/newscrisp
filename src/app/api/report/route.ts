import { addReport } from "@/lib/store";

const REASONS = new Set(["wrong-facts", "misleading-headline", "duplicate", "opinion-not-news", "offensive", "other"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { shortId?: string; reason?: string; device?: string } | null;
  if (!body?.shortId || !body.device || !body.reason || !REASONS.has(body.reason)) {
    return Response.json({ error: "shortId, device and a valid reason are required" }, { status: 400 });
  }
  await addReport(body.shortId, body.reason, body.device);
  return Response.json({ ok: true });
}
