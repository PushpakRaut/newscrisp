import { EDITION } from "@/lib/edition";
import { getShorts } from "@/lib/news";
import type { FeedResponse } from "@/lib/types";

export async function GET() {
  const { shorts, fetchedAt, failedSources } = await getShorts();
  const body: FeedResponse = { shorts, fetchedAt, edition: EDITION, failedSources };
  return Response.json(body);
}
