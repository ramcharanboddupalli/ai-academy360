import { Router, type Request, type Response } from 'express';
import { DatabaseConfigurationError } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { AIInvalidResponseError, AIProviderTimeoutError, AIProviderUnavailableError, aiService } from '../services/ai/ai.service.js';
import {
  ANALYTICS_PERIODS,
  createManagementInsightSnapshot,
  getAnalyticsOverview,
  getCategoryBreakdown,
  getDepartmentBreakdown,
  getNeedsAttention,
  getManagementInsight,
  getManagementInsightHistory,
  getPriorityBreakdown,
  getSentimentBreakdown,
  getPeriodStartDate,
  getTicketStatusBreakdown,
  getTicketTrends,
  saveManagementInsight,
  type AnalyticsPeriod,
} from '../services/analytics/analytics.service.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

function parsePeriod(value: unknown): AnalyticsPeriod | null {
  if (value === undefined || value === '') return 'last_7_days';
  return typeof value === 'string' && Object.hasOwn(ANALYTICS_PERIODS, value)
    ? value as AnalyticsPeriod
    : null;
}

function handleDatabaseFailure(res: Response) {
  return res.status(503).json({ success: false, message: 'Academy analytics are temporarily unavailable.' });
}

function handleAIError(res: Response, error: unknown) {
  if (error instanceof AIProviderTimeoutError) {
    return res.status(504).json({ success: false, message: 'Groq insights generation timed out. No insight was saved.' });
  }
  if (error instanceof AIInvalidResponseError) {
    return res.status(502).json({ success: false, message: 'Groq returned invalid management insights. No insight was saved.', diagnostic: { category: error.category, ...error.details } });
  }
  if (error instanceof AIProviderUnavailableError) {
    return res.status(503).json({
      success: false,
      message: 'Groq insights are temporarily unavailable. No insight was saved.',
      diagnostic: { category: error.category, providerStatus: error.providerStatus },
    });
  }
  return res.status(503).json({ success: false, message: 'AI insights are temporarily unavailable. No insight was saved.' });
}

router.get('/analytics/overview', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, analytics: await getAnalyticsOverview(period) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/analytics/trends', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, trends: await getTicketTrends(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/analytics/departments', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, departments: await getDepartmentBreakdown(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/analytics/sentiments', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, sentiments: await getSentimentBreakdown(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/analytics/priorities', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, priorities: await getPriorityBreakdown(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/analytics/categories', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, categories: await getCategoryBreakdown(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/analytics/statuses', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, statuses: await getTicketStatusBreakdown(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/ai-insights', async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, insights: await getManagementInsightHistory() });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.get('/ai-insights/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Insight ID is invalid.' });
  try {
    const insight = await getManagementInsight(id);
    if (!insight) return res.status(404).json({ success: false, message: 'Insight not found.' });
    return res.json({ success: true, insight });
  } catch {
    return handleDatabaseFailure(res);
  }
});

router.post('/ai-insights/generate', async (req: Request, res: Response) => {
  const period = parsePeriod(req.body?.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    const analytics = await getAnalyticsOverview(period);
    const aggregateSnapshot = createManagementInsightSnapshot(analytics);
    const { insights, model } = await aiService.generateManagementInsights(aggregateSnapshot);
    const saved = await saveManagementInsight(req.authUser!.id, period, model, aggregateSnapshot, insights);
    if (!saved) return res.status(500).json({ success: false, message: 'Validated insights could not be saved.' });
    return res.status(201).json({ success: true, insight: saved });
  } catch (error) {
    if (error instanceof AIProviderTimeoutError || error instanceof AIInvalidResponseError || error instanceof AIProviderUnavailableError) {
      return handleAIError(res, error);
    }
    if (error instanceof DatabaseConfigurationError) return handleDatabaseFailure(res);
    return res.status(500).json({ success: false, message: 'Insights could not be generated or saved.' });
  }
});

router.get('/analytics/needs-attention', async (req: Request, res: Response) => {
  const period = parsePeriod(req.query.period);
  if (!period) return res.status(400).json({ success: false, message: 'Period must be last_7_days, last_30_days, or last_90_days.' });
  try {
    return res.json({ success: true, period, tickets: await getNeedsAttention(getPeriodStartDate(period)) });
  } catch {
    return handleDatabaseFailure(res);
  }
});

export default router;