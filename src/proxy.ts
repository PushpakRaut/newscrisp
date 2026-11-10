import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { IS_PUBLIC } from "./lib/edition";

const PASSWORD = process.env.SITE_PASSWORD;

/**
 * The full edition is private: every request needs the site password (any user name works).
 * The public edition stays open. Runs before every page, API route and file.
 */
export function proxy(request: NextRequest) {
  if (IS_PUBLIC) return NextResponse.next();
  if (!PASSWORD) {
    // Never serve the private edition openly just because the password setting was forgotten.
    if (process.env.NODE_ENV === "production") {
      return new Response("This private edition is locked. Set SITE_PASSWORD to open it.", { status: 503 });
    }
    return NextResponse.next(); // local `npm run dev:full`
  }
  const [scheme, encoded] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    const given = Buffer.from(Buffer.from(encoded, "base64").toString().split(":").slice(1).join(":"));
    const expected = Buffer.from(PASSWORD);
    if (given.length === expected.length && timingSafeEqual(given, expected)) return NextResponse.next();
  }
  return new Response("NewsCrisp private edition: password required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="NewsCrisp private edition", charset="UTF-8"' },
  });
}
