import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { piiMaskingMiddleware } from "./middlewares/pii-masking-middleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply PII masking middleware to protect sensitive data in dashboards
app.use(piiMaskingMiddleware({ 
  enableMasking: process.env.ENABLE_PII_MASKING !== "false",
  logMaskedFields: process.env.LOG_MASKED_FIELDS === "true"
}));

app.use("/api", router);

export default app;
