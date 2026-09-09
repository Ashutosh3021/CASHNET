/**
 * Model Serving Endpoints
 * Exposes ML models (182, 183, 184) as REST API endpoints
 * Models are loaded on-demand and cached in memory
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Configuration
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

/**
 * GET /models/status
 * Get status of all available models
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/models/status`);
    return res.json(response.data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Failed to get model status',
      details: error.message,
    });
  }
});

/**
 * POST /models/predict/182
 * Predict using Model 182 (Crypto/VASP/Cross-Border)
 * Request body:
 * {
 *   "record": {
 *     "risk_score": 0.75,
 *     "transaction_count": 150,
 *     "amount": 50000,
 *     ...
 *   }
 * }
 */
router.post('/predict/182', async (req: Request, res: Response) => {
  try {
    const { record } = req.body;

    if (!record) {
      return res.status(400).json({ error: 'Record is required' });
    }

    const response = await axios.post(`${PYTHON_SERVICE_URL}/models/predict/182`, {
      record,
    }, { timeout: 30_000 });

    return res.json(response.data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Model 182 prediction failed',
      details: error.message,
    });
  }
});

/**
 * POST /models/predict/183
 * Predict using Model 183 (AML Detection)
 */
router.post('/predict/183', async (req: Request, res: Response) => {
  try {
    const { record } = req.body;

    if (!record) {
      return res.status(400).json({ error: 'Record is required' });
    }

    const response = await axios.post(`${PYTHON_SERVICE_URL}/models/predict/183`, {
      record,
    }, { timeout: 30_000 });

    return res.json(response.data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Model 183 prediction failed',
      details: error.message,
    });
  }
});

/**
 * POST /models/predict/184
 * Predict using Model 184 (Complaint Typology)
 */
router.post('/predict/184', async (req: Request, res: Response) => {
  try {
    const { record } = req.body;

    if (!record) {
      return res.status(400).json({ error: 'Record is required' });
    }

    const response = await axios.post(`${PYTHON_SERVICE_URL}/models/predict/184`, {
      record,
    }, { timeout: 30_000 });

    return res.json(response.data);
  } catch (error: any) {
    return res.status(500).json({
      error: 'Model 184 prediction failed',
      details: error.message,
    });
  }
});

/**
 * POST /models/batch-predict
 * Batch predictions across multiple records/models
 */
router.post('/batch-predict', async (req: Request, res: Response) => {
  try {
    const { records, modelIds = [182, 183, 184] } = req.body;

    if (!records || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Records array is required' });
    }

    const results = [];

    for (const modelId of modelIds) {
      const batchResults = [];

      for (const record of records) {
        try {
          const response = await axios.post(
            `${PYTHON_SERVICE_URL}/models/predict/${modelId}`,
            { record },
            { timeout: 30_000 }
          );
          batchResults.push(response.data);
        } catch (error: any) {
          batchResults.push({
            model_id: modelId,
            error: error.message,
            record_id: record.id,
          });
        }
      }

      results.push({
        model_id: modelId,
        count: batchResults.length,
        predictions: batchResults,
      });
    }

    return res.json({
      timestamp: new Date().toISOString(),
      total_records: records.length,
      models_processed: modelIds.length,
      results,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Batch prediction failed',
      details: error.message,
    });
  }
});

/**
 * POST /models/reload
 * Reload all models (clear cache, retrain if needed)
 * Admin only
 */
router.post('/reload', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${PYTHON_SERVICE_URL}/models/reload`);
    return res.json({
      message: 'Models reloaded successfully',
      status: response.data,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: 'Model reload failed',
      details: error.message,
    });
  }
});

/**
 * GET /models/health
 * Check health of model service
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
      timeout: 5000,
    });
    return res.json({
      status: 'healthy',
      python_service: response.data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(503).json({
      status: 'unhealthy',
      error: 'Python service unreachable',
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /models/info
 * Get information about available models
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/models/info`, {
      timeout: 5000,
    });
    return res.json(response.data);
  } catch (error: any) {
    return res.status(503).json({
      error: 'Python service unreachable',
      details: error.message,
    });
  }
});

/**
 * GET /models/evaluation/:modelId
 * Get evaluation metrics for a specific model
 */
router.get('/evaluation/:modelId', async (req: Request, res: Response) => {
  try {
    const { modelId } = req.params;
    const response = await axios.get(`${PYTHON_SERVICE_URL}/models/evaluation/${modelId}`, {
      timeout: 10000,
    });
    return res.json(response.data);
  } catch (error: any) {
    return res.status(503).json({
      error: 'Failed to get model evaluation',
      details: error.message,
    });
  }
});

/**
 * GET /models/provenance
 * Get provenance information for all models
 */
router.get('/provenance', async (req: Request, res: Response) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/models/provenance`, {
      timeout: 10000,
    });
    return res.json(response.data);
  } catch (error: any) {
    return res.status(503).json({
      error: 'Failed to get model provenance',
      details: error.message,
    });
  }
});

export default router;
