/**
 * V1 API Routes - Authentication & Key Management
 */

import { Router, type IRouter, Request, Response } from "express";
import { generateKey, revokeKey, rotateKey, listKeys } from "../../lib/api-key-store";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

/**
 * POST /auth/keys - Generate new API key
 */
router.post("/auth/keys", (req: Request, res: Response) => {
  try {
    const { name, tier, permissions, expiresInDays } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Missing required field: name" });
    }

    const { rawKey, record } = generateKey({
      name,
      tier,
      permissions,
      expiresInDays,
    });

    logger.info({ keyId: record.id, name, tier }, "API key generated");

    return res.status(201).json({
      success: true,
      message: "API key generated. Store the raw key securely — it will not be shown again.",
      data: {
        id: record.id,
        key: rawKey,
        keyPrefix: record.keyPrefix,
        name: record.name,
        tier: record.tier,
        permissions: record.permissions,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to generate API key");
    return res.status(500).json({ error: "Failed to generate API key" });
  }
});

/**
 * GET /auth/keys - List all API keys
 */
router.get("/auth/keys", (_req: Request, res: Response) => {
  try {
    const keys = listKeys();
    return res.json({ success: true, data: keys, count: keys.length });
  } catch (error) {
    logger.error({ error }, "Failed to list API keys");
    return res.status(500).json({ error: "Failed to list API keys" });
  }
});

/**
 * DELETE /auth/keys/:keyId - Revoke API key
 */
router.delete("/auth/keys/:keyId", (req: Request, res: Response) => {
  try {
    const keyId = String(req.params.keyId);
    const revoked = revokeKey(keyId);

    if (!revoked) {
      return res.status(404).json({ error: "Key not found" });
    }

    logger.info({ keyId }, "API key revoked");
    return res.json({ success: true, message: "API key revoked" });
  } catch (error) {
    logger.error({ error }, "Failed to revoke API key");
    return res.status(500).json({ error: "Failed to revoke API key" });
  }
});

/**
 * POST /auth/keys/:keyId/rotate - Rotate API key
 */
router.post("/auth/keys/:keyId/rotate", (req: Request, res: Response) => {
  try {
    const keyId = String(req.params.keyId);
    const result = rotateKey(keyId);

    if (!result) {
      return res.status(404).json({ error: "Key not found or already revoked" });
    }

    logger.info({ keyId }, "API key rotated");
    return res.json({
      success: true,
      message: "API key rotated. Store the new key securely.",
      data: {
        id: result.record.id,
        key: result.rawKey,
        keyPrefix: result.record.keyPrefix,
        name: result.record.name,
        tier: result.record.tier,
      },
    });
  } catch (error) {
    logger.error({ error }, "Failed to rotate API key");
    return res.status(500).json({ error: "Failed to rotate API key" });
  }
});

export default router;
