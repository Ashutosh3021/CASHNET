/**
 * V1 API Routes - Health & Usage
 */

import { Router, type IRouter, Request, Response } from "express";

const router: IRouter = Router();

/**
 * GET /health - API health check
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    features: {
      analytics: true,
      cases: true,
      wallets: true,
      incidentLinking: true,
    },
  });
});

export default router;
