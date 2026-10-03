import { Router, type Request, type Response } from 'express';
import { authenticateToken, requireAdmin, requireStudent } from '../middleware/auth.middleware.js';
import {
  getUnreadNotificationCount,
  getUserNotifications,
  createDueAnnouncementNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../services/notification.service.js';

function createNotificationRouter(role: 'ADMIN' | 'STUDENT') {
  const router = Router();
  router.use(authenticateToken, role === 'ADMIN' ? requireAdmin : requireStudent);

  router.get('/', async (req: Request, res: Response) => {
    try {
      const userId = req.authUser!.id;
      if (role === 'STUDENT') await createDueAnnouncementNotifications(userId);
      const [notifications, unreadCount] = await Promise.all([
        getUserNotifications(userId),
        getUnreadNotificationCount(userId),
      ]);
      return res.json({ success: true, notifications, unreadCount });
    } catch {
      return res.status(503).json({ success: false, message: 'Notifications are temporarily unavailable.' });
    }
  });

  router.get('/unread-count', async (req: Request, res: Response) => {
    try {
      return res.json({ success: true, unreadCount: await getUnreadNotificationCount(req.authUser!.id) });
    } catch {
      return res.status(503).json({ success: false, message: 'Unread notification count is temporarily unavailable.' });
    }
  });

  router.patch('/read-all', async (req: Request, res: Response) => {
    try {
      const updatedCount = await markAllNotificationsAsRead(req.authUser!.id);
      return res.json({ success: true, updatedCount });
    } catch {
      return res.status(503).json({ success: false, message: 'Notifications could not be marked as read.' });
    }
  });

  router.patch('/:id/read', async (req: Request, res: Response) => {
    const notificationId = Number(req.params.id);
    if (!Number.isSafeInteger(notificationId) || notificationId < 1) {
      return res.status(400).json({ success: false, message: 'Notification ID is invalid.' });
    }
    try {
      const updated = await markNotificationAsRead(req.authUser!.id, notificationId);
      if (!updated) return res.status(404).json({ success: false, message: 'Notification not found.' });
      return res.json({ success: true });
    } catch {
      return res.status(503).json({ success: false, message: 'Notification could not be marked as read.' });
    }
  });

  return router;
}

export const studentNotificationRoutes = createNotificationRouter('STUDENT');
export const adminNotificationRoutes = createNotificationRouter('ADMIN');
