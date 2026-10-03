import { Router, type Request, type Response } from 'express';
import { DatabaseConfigurationError } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import {
  addAdminTicketMessage,
  assignTicket,
  getAdminAssignees,
  getAdminTicket,
  getAdminTickets,
  TicketAdminNotFoundError,
  TICKET_STATUSES,
  updateTicketStatus,
} from '../services/tickets/ticket.service.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

function getTicketNumber(req: Request): string {
  const value = req.params.ticketNumber;
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function sendFailure(res: Response, error: unknown, fallback: string) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'Ticket service is temporarily unavailable.' });
  }
  if (error instanceof TicketAdminNotFoundError) {
    return res.status(404).json({ success: false, message: 'The selected assignee was not found.' });
  }
  return res.status(500).json({ success: false, message: fallback });
}

router.get('/tickets', async (req: Request, res: Response) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 150) : undefined;
  const category = typeof req.query.category === 'string' ? req.query.category.trim().slice(0, 100) : undefined;
  const department = typeof req.query.department === 'string' ? req.query.department.trim().slice(0, 150) : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  try {
    const result = await getAdminTickets({ search, category, department, status, priority });
    return res.json({ success: true, ...result });
  } catch (error) {
    return sendFailure(res, error, 'Support requests could not be loaded.');
  }
});

router.get('/ticket-assignees', async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, assignees: await getAdminAssignees() });
  } catch (error) {
    return sendFailure(res, error, 'Ticket assignees could not be loaded.');
  }
});

router.get('/tickets/:ticketNumber', async (req: Request, res: Response) => {
  try {
    const ticket = await getAdminTicket(getTicketNumber(req));
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found.' });
    return res.json({ success: true, ticket });
  } catch (error) {
    return sendFailure(res, error, 'Support request details could not be loaded.');
  }
});

router.patch('/tickets/:ticketNumber/status', async (req: Request, res: Response) => {
  const status = req.body?.status;
  if (typeof status !== 'string' || !(TICKET_STATUSES as readonly string[]).includes(status)) {
    return res.status(422).json({ success: false, message: 'Choose a valid support request status.' });
  }
  try {
    const ticket = await updateTicketStatus(getTicketNumber(req), status as (typeof TICKET_STATUSES)[number], req.authUser!.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found.' });
    return res.json({ success: true, ticket });
  } catch (error) {
    return sendFailure(res, error, 'Support request status could not be updated.');
  }
});

router.post('/tickets/:ticketNumber/messages', async (req: Request, res: Response) => {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > 5000) {
    return res.status(422).json({ success: false, message: 'Response must be between 1 and 5000 characters.' });
  }
  try {
    const ticket = await addAdminTicketMessage(getTicketNumber(req), req.authUser!.id, message);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found.' });
    return res.json({ success: true, ticket });
  } catch (error) {
    return sendFailure(res, error, 'Your response could not be sent.');
  }
});

router.patch('/tickets/:ticketNumber/assignment', async (req: Request, res: Response) => {
  const rawAdminId = req.body?.adminId;
  const adminId = rawAdminId === null ? null : Number(rawAdminId);
  if (adminId !== null && (!Number.isSafeInteger(adminId) || adminId < 1)) {
    return res.status(422).json({ success: false, message: 'Choose a valid assignee.' });
  }
  try {
    const ticket = await assignTicket(getTicketNumber(req), adminId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Support request not found.' });
    return res.json({ success: true, ticket });
  } catch (error) {
    return sendFailure(res, error, 'Ticket assignment could not be updated.');
  }
});

export default router;