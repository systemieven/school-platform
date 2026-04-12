/**
 * In-memory rate limiter for Supabase Edge Functions.
 *
 * Uses a sliding window counter per IP. The Map persists as long as the
 * Deno Deploy isolate is alive (typically minutes), which is enough to
 * stop burst abuse. For sustained attacks, Supabase's built-in DDoS
 * protection at the edge layer takes over.
 *
 * Usage:
 *   import { rateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
 *
 *   const rl = rateLimit(req, { maxRequests: 10, windowMs: 60_000 });
 *   if (!rl.ok) return rateLimitResponse(rl, CORS);
 */

interface RateLimitOptions {
  /** Max requests per window (default: 20) */
  maxRequests?: number;
  /** Window duration in ms (default: 60_000 = 1 minute) */
  windowMs?: number;
  /** Custom key extractor — defaults to IP from headers */
  keyFn?: (req: Request) => string;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
  retryAfterMs: number;
}

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Global store — survives across requests within the same isolate
const store = new Map<string, WindowEntry>();

// Periodic cleanup to avoid memory leaks (every 5 minutes)
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60_000);
}

/**
 * Extract client IP from standard proxy headers.
 */
function getClientIP(req: Request): string {
  // Supabase Edge Functions set these headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Cloudflare
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  return "unknown";
}

/**
 * Check rate limit for a request.
 */
export function rateLimit(
  req: Request,
  opts: RateLimitOptions = {},
): RateLimitResult {
  const {
    maxRequests = 20,
    windowMs = 60_000,
    keyFn,
  } = opts;

  ensureCleanup();

  const key = keyFn ? keyFn(req) : getClientIP(req);
  const now = Date.now();

  let entry = store.get(key);

  // Window expired or no entry — start fresh
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  const remaining = Math.max(0, maxRequests - entry.count);
  const retryAfterMs = entry.count > maxRequests ? entry.resetAt - now : 0;

  return {
    ok: entry.count <= maxRequests,
    remaining,
    limit: maxRequests,
    resetAt: entry.resetAt,
    retryAfterMs,
  };
}

/**
 * Build a 429 response with standard rate limit headers.
 */
export function rateLimitResponse(
  rl: RateLimitResult,
  corsHeaders: Record<string, string> = {},
): Response {
  const retryAfterSec = Math.ceil(rl.retryAfterMs / 1000);

  return new Response(
    JSON.stringify({
      error: "rate_limit_exceeded",
      message: `Muitas requisições. Tente novamente em ${retryAfterSec} segundo(s).`,
      retry_after: retryAfterSec,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
        "X-RateLimit-Limit": String(rl.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(rl.resetAt / 1000)),
      },
    },
  );
}
