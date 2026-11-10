import { addComment, listComments } from "@/lib/store";

export async function GET(request: Request) {
  const shortId = new URL(request.url).searchParams.get("shortId");
  if (!shortId) return Response.json({ error: "shortId is required" }, { status: 400 });
  return Response.json({ comments: await listComments(shortId) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { shortId?: string; handle?: string; text?: string } | null;
  const text = body?.text?.trim() ?? "";
  const handle = body?.handle?.trim().replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 24) ?? "";
  if (!body?.shortId || !handle || !text) {
    return Response.json({ error: "shortId, handle and text are required" }, { status: 400 });
  }
  if (text.length > 500) return Response.json({ error: "Comments are limited to 500 characters" }, { status: 400 });
  return Response.json({ comment: await addComment(body.shortId, handle, text) });
}
