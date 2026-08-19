import { NextRequest, NextResponse } from "next/server";

// Best-effort abuse guard (CHECK.md item 3): this app has no auth by design
// (CLAUDE.md — link secrecy only), so anyone with the link can call any
// /api/* route. This in-memory limiter is NOT a robust distributed rate
// limiter — each Vercel serverless instance keeps its own memory, so a
// determined attacker spreading requests across instances isn't fully
// stopped. It closes the cheap, obvious abuse path (a script looping DELETE
// to wipe the library, or hammering synthesize/compare to run up OpenAI
// costs) at zero infrastructure cost. A real fix (Vercel Deployment
// Protection or similar) is a deliberate auth-adjacent decision left to you.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
const MAX_TRACKED_CLIENTS = 10_000; // crude safety valve against unbounded growth

const hits = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}

export function proxy(request: NextRequest) {
  if (hits.size > MAX_TRACKED_CLIENTS) hits.clear();

  const key = getClientKey(request);
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  entry.count += 1;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      {
        error: {
          code: "rate-limited",
          message: "Too many requests. Please wait a moment and try again.",
        },
      },
      { status: 429 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
