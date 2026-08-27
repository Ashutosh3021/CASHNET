import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cashnetRouter from "./cashnet";
import geospatialRouter from "./geospatial";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cashnetRouter);
router.use(geospatialRouter);

export default router;
