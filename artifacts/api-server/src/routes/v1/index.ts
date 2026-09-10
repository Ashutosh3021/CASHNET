/**
 * V1 API Router
 *
 * Aggregates all v1 routes under /api/v1/*.
 * External consumers authenticate with X-Api-Key header.
 * Rate limiting is applied per API key tier.
 */

import { Router, type IRouter } from "express";
import { apiKeyAuth } from "../../middlewares/api-key-auth";
import { rateLimiter } from "../../middlewares/rate-limiter";
import healthRouter from "./health";
import authRouter from "./auth";
import analyticsRouter from "./analytics";
import casesRouter from "./cases";
import walletsRouter from "./wallets";

const router: IRouter = Router();

// Health check is public (no auth required)
router.use(healthRouter);

// Auth routes (key management) require internal auth or admin key
router.use(authRouter);

// All data routes require API key + rate limiting
router.use(apiKeyAuth);
router.use(rateLimiter);
router.use(analyticsRouter);
router.use(casesRouter);
router.use(walletsRouter);

export default router;
