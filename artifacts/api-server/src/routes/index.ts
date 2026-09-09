import { Router, type IRouter } from "express";
import integrationsRouter from "./integrations";
import healthRouter from "./health";
import cashnetRouter from "./cashnet";
import geospatialRouter from "./geospatial";
import legalHoldRouter from "./legal-hold";
import casesExtendedRouter from "./cases-extended";
import evidencePackagesRouter from "./evidence-packages";
import actionRequestsRouter from "./action-requests";
import modelsRouter from "./models";
import corridorRouter from "./corridor";
import blockchainRouter from "./blockchain";
import dataSourcesRouter from "./data-sources";

const router: IRouter = Router();

router.use("/integrations", integrationsRouter);
router.use(healthRouter);
router.use(cashnetRouter);
router.use(geospatialRouter);
router.use(corridorRouter);
router.use(legalHoldRouter);
router.use(casesExtendedRouter);
router.use(evidencePackagesRouter);
router.use(actionRequestsRouter);
router.use("/models", modelsRouter);
router.use("/blockchain", blockchainRouter);
router.use(dataSourcesRouter);

export default router;
