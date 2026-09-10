/**
 * Rate Limiter Middleware
 *
 * Token-bucket rate limiting per API key tier.
 * Uses in-memory counters (resets on restart — acceptable for MVP).
 */

import type { Request, Response, NextFunction } from "express";
import { getTierLimits } from "../lib/api-key-store";
import type { AuthenticatedRequest } from "./api-key-auth";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key);
  }
}, 300_000);

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const consumer = (req as AuthenticatedRequest).apiConsumer;
  if (!consumer) {
    next();
    return;
  }

  const limits = getTierLimits(consumer.tier);
  const now = Date.now();
  const bucketKey = consumer.id;
  let bucket = buckets.get(bucketKey);

  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + 60_000 };
    buckets.set(bucketKey, bucket);
  }

  bucket.count++;

  const remaining = Math.max(0, limits.requestsPerMinute - bucket.count);
  const resetDate = new Date(bucket.resetAt);

  res.setHeader("X-RateLimit-Limit", String(limits.requestsPerMinute));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", resetDate.toISOString());

  if (bucket.count > limits.requestsPerMinute) {
    res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: `Rate limit of ${limits.requestsPerMinute} requests/minute exceeded for ${consumer.tier} tier.`,
      retryAfter: resetDate.toISOString(),
    });
    return;
  }

  next();
}
