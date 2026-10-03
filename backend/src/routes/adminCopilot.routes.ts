import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { DatabaseConfigurationError } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { AIInvalidResponseError, AIProviderTimeoutError, AIProviderUnavailableError, aiService } from '../services/ai/ai.service.js';
import { getAdminCopilotSnapshot } from '../services/adminCopilot.service.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

const questionSchema = z.object({
  question: z.string().trim().min(3).max(1000),
}).strict();

router.post('/ai-copilot/ask', async (req: Request, res: Response) => {
  const parsed = questionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Enter a question between 3 and 1000 characters.' });
  }
  try {
    const snapshot = await getAdminCopilotSnapshot();
    const result = await aiService.answerAdminCopilot(parsed.data.question, snapshot);
    return res.json({ success: true, response: result.response, provider: 'Groq', model: result.model });
  } catch (error) {
    if (error instanceof AIProviderTimeoutError) {
      return res.status(504).json({ success: false, message: 'The AI Admin Copilot timed out. Please try again.' });
    }
    if (error instanceof AIInvalidResponseError) {
      return res.status(502).json({ success: false, message: 'The AI response could not be validated against academy data.' });
    }
    if (error instanceof AIProviderUnavailableError) {
      return res.status(503).json({ success: false, message: 'The AI Admin Copilot is temporarily unavailable.' });
    }
    if (error instanceof DatabaseConfigurationError) {
      return res.status(503).json({ success: false, message: 'Academy data is temporarily unavailable.' });
    }
    return res.status(500).json({ success: false, message: 'The AI Admin Copilot could not answer the question.' });
  }
});

export default router;
