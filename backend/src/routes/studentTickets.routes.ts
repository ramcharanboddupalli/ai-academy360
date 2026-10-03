import { Router, type Request, type Response } from 'express';
import { DatabaseConfigurationError } from '../config/database.js';
import { authenticateToken, requireStudent } from '../middleware/auth.middleware.js';
import { aiService, AIInvalidResponseError, AIProviderTimeoutError, AIProviderUnavailableError } from '../services/ai/ai.service.js';
import { getDepartmentNames, createAnalyzedTicket, StudentAccountUnavailableError, TicketDepartmentMissingError, getStudentTicket, getStudentTickets } from '../services/tickets/ticket.service.js';

const router = Router();
router.use(authenticateToken, requireStudent);

function getTicketNumber(req: Request): string {
  const value = req.params.ticketNumber;
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function sendDatabaseFailure(res: Response, error: unknown, fallback: string) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'The support service is temporarily unavailable.' });
  }
  if (error instanceof StudentAccountUnavailableError) {
    return res.status(403).json({ success: false, message: 'An active student account is required.' });
  }
  if (error instanceof TicketDepartmentMissingError) {
    return res.status(503).json({ success: false, message: 'Support departments are not configured.' });
  }
  return res.status(500).json({ success: false, message: fallback });
}

router.post('/ai-support/analyze-and-submit', async (req: Request, res: Response) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (message.length < 10 || message.length > 5000) {
    return res.status(422).json({ success: false, message: 'Describe your issue in 10 to 5000 characters.' });
  }

  try {
    const departments = await getDepartmentNames();
    if (departments.length === 0) {
      return res.status(503).json({ success: false, message: 'Support departments are not configured.' });
    }
    const { analysis, model } = await aiService.analyzeRequest({ message }, departments);
    const ticket = await createAnalyzedTicket(req.authUser!.id, message, analysis);
    return res.status(201).json({
      success: true,
      message: 'Your support request has been submitted.',
      ticket,
      analysis: { ...analysis, model },
    });
  } catch (error) {
    if (error instanceof AIProviderTimeoutError) {
      return res.status(504).json({ success: false, message: 'AI analysis timed out. Your request was not submitted; please try again.' });
    }
    if (error instanceof AIInvalidResponseError) {
      return res.status(502).json({ success: false, message: 'AI could not validate an analysis. Your request was not submitted; please try again.' });
    }
    if (error instanceof AIProviderUnavailableError) {
      return res.status(503).json({
        success: false,
        message: 'AI support is temporarily unavailable. Your request was not submitted.',
        diagnostic: { category: error.category, providerStatus: error.providerStatus },
      });
    }
    return sendDatabaseFailure(res, error, 'Your support request could not be submitted.');
  }
});

router.get('/tickets', async (req: Request, res: Response) => {
  try {
    const tickets = await getStudentTickets(req.authUser!.id);
    return res.json({ success: true, tickets });
  } catch (error) {
    return sendDatabaseFailure(res, error, 'Your support requests could not be loaded.');
  }
});

router.get('/tickets/:ticketNumber', async (req: Request, res: Response) => {
  try {
    const ticket = await getStudentTicket(req.authUser!.id, getTicketNumber(req));
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found.' });
    return res.json({ success: true, ticket });
  } catch (error) {
    return sendDatabaseFailure(res, error, 'Support request details could not be loaded.');
  }
});

export default router;