import { getShorts } from "@/lib/news";
import { counts } from "@/lib/store";
import type { FeedResponse } from "@/lib/types";

export async function GET() {
  const { shorts, fetchedAt, failedSources, aiSummaries } = await getShorts();
  const { comments } = await counts(shorts.map((s) => s.id));
  const body: FeedResponse = { shorts, comments, fetchedAt, aiSummaries, failedSources };
  return Response.json(body);
}
