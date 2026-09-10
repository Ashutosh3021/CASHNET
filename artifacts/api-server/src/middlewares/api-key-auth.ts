/**
 * API Key Authentication Middleware
 *
 * Validates X-Api-Key header for external API consumers.
 * Attaches key record to request for downstream rate limiting.
 */

import type { Request, Response, NextFunction } from "express";
import { validateApiKey } from "../lib/api-key-store";
import type { ApiKeyRecord } from "../lib/api-key-store";

export interface AuthenticatedRequest extends Request {
  apiConsumer?: ApiKeyRecord;
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-api-key"] as string | undefined;

  if (!key) {
    res.status(401).json({
      error: "MISSING_API_KEY",
      message: "X-Api-Key header required. Generate a key at POST /api/v1/auth/keys.",
    });
    return;
  }

  const record = validateApiKey(key);
  if (!record) {
    res.status(403).json({
      error: "INVALID_API_KEY",
      message: "API key not recognized or has been revoked.",
    });
    return;
  }

  (req as AuthenticatedRequest).apiConsumer = record;
  next();
}
