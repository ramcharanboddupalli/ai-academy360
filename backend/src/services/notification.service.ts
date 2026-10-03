import type { Pool, PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { getDatabasePool } from '../config/database.js';

export const NOTIFICATION_TYPES = [
  'ANNOUNCEMENT',
  'CLASS',
  'PAYMENT',
  'TASK',
  'COMPLAINT',
  'CERTIFICATE',
  'INTERNSHIP',
  'SYSTEM',
  'AI_INSIGHT',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
type NotificationExecutor = Pool | PoolConnection;

export type NotificationInput = {
  userId: number;
  title: string;
  message: string;
  type?: NotificationType;
  referenceType?: string | null;
  referenceId?: string | number | null;
  dedupeKey?: string | null;
};

export async function createNotification(executor: NotificationExecutor, notification: NotificationInput) {
  await executor.execute(
    `INSERT IGNORE INTO notifications
       (user_id, title, message, notification_type, reference_type, reference_id, dedupe_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      notification.userId,
      notification.title,
      notification.message,
      notification.type ?? 'SYSTEM',
      notification.referenceType ?? null,
      notification.referenceId === null || notification.referenceId === undefined ? null : String(notification.referenceId),
      notification.dedupeKey ?? null,
    ],
  );
}

export async function createBulkNotifications(
  executor: NotificationExecutor,
  notifications: NotificationInput[],
) {
  if (!notifications.length) return;
  const values = notifications.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
  const parameters = notifications.flatMap((notification) => [
    notification.userId,
    notification.title,
    notification.message,
    notification.type ?? 'SYSTEM',
    notification.referenceType ?? null,
    notification.referenceId === null || notification.referenceId === undefined ? null : String(notification.referenceId),
    notification.dedupeKey ?? null,
  ]);
  await executor.execute(
    `INSERT IGNORE INTO notifications
       (user_id, title, message, notification_type, reference_type, reference_id, dedupe_key)
     VALUES ${values}`,
    parameters,
  );
}

export async function notifyCourseStudents(
  executor: PoolConnection,
  courseId: number,
  input: Omit<NotificationInput, 'userId'> & { dedupeKey: string },
) {
  const [students] = await executor.execute<RowDataPacket[]>(
    `SELECT DISTINCT u.id AS userId FROM enrollments e
     JOIN students s ON s.id = e.student_id AND s.status = 'Active'
     JOIN users u ON u.id = s.user_id AND u.is_active = TRUE AND u.role = 'STUDENT'
     WHERE e.course_id = ? AND e.status = 'active'`,
    [courseId],
  );
  await createBulkNotifications(executor, students.map((student) => ({
    ...input,
    userId: Number(student.userId),
    dedupeKey: `${input.dedupeKey}:${student.userId}`,
  })));
}

export async function notifyAdmins(
  executor: PoolConnection,
  input: Omit<NotificationInput, 'userId'> & { dedupeKey: string },
) {
  const [admins] = await executor.execute<RowDataPacket[]>(
    `SELECT u.id AS userId FROM users u
     JOIN admins a ON a.user_id = u.id
     WHERE u.role = 'ADMIN' AND u.is_active = TRUE`,
  );
  await createBulkNotifications(executor, admins.map((admin) => ({
    ...input,
    userId: Number(admin.userId),
    dedupeKey: `${input.dedupeKey}:${admin.userId}`,
  })));
}

export async function notifyPublishedAnnouncement(executor: PoolConnection, announcementId: number) {
  const [recipients] = await executor.execute<RowDataPacket[]>(
    `SELECT DISTINCT u.id AS userId, a.title, a.message,
            DATE_FORMAT(COALESCE(a.published_at, a.created_at), '%Y%m%d%H%i%s') AS publishKey
     FROM announcements a
     JOIN students s ON s.status = 'Active'
     JOIN users u ON u.id = s.user_id AND u.is_active = TRUE AND u.role = 'STUDENT'
     WHERE a.id = ? AND a.is_published = TRUE
       AND (a.scheduled_at IS NULL OR a.scheduled_at <= CURRENT_TIMESTAMP)
       AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
       AND (a.target_type = 'all'
         OR (a.target_type = 'student' AND a.target_student_id = s.id)
         OR (a.target_type = 'course' AND EXISTS (
           SELECT 1 FROM enrollments e WHERE e.student_id = s.id
             AND e.course_id = a.target_course_id AND e.status <> 'dropped'
         )))`,
    [announcementId],
  );
  await createBulkNotifications(executor, recipients.map((recipient) => ({
    userId: Number(recipient.userId),
    title: String(recipient.title),
    message: String(recipient.message),
    type: 'ANNOUNCEMENT',
    referenceType: 'announcement',
    referenceId: announcementId,
    dedupeKey: `announcement:${announcementId}:published:${recipient.publishKey}:${recipient.userId}`,
  })));
}

export async function createDueAnnouncementNotifications(userId: number) {
  await getDatabasePool().execute(
    `INSERT IGNORE INTO notifications
       (user_id, title, message, notification_type, reference_type, reference_id, dedupe_key)
     SELECT u.id, a.title, a.message, 'ANNOUNCEMENT', 'announcement', CAST(a.id AS CHAR),
            CONCAT('announcement:', a.id, ':published:', DATE_FORMAT(COALESCE(a.published_at, a.created_at), '%Y%m%d%H%i%s'), ':', u.id)
     FROM users u
     JOIN students s ON s.user_id = u.id AND s.status = 'Active'
     JOIN announcements a ON a.is_published = TRUE
       AND (a.scheduled_at IS NULL OR a.scheduled_at <= CURRENT_TIMESTAMP)
       AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
       AND (a.target_type = 'all'
         OR (a.target_type = 'student' AND a.target_student_id = s.id)
         OR (a.target_type = 'course' AND EXISTS (
           SELECT 1 FROM enrollments e WHERE e.student_id = s.id
             AND e.course_id = a.target_course_id AND e.status <> 'dropped'
         )))
     WHERE u.id = ? AND u.role = 'STUDENT' AND u.is_active = TRUE`,
    [userId],
  );
}

export async function getUserNotifications(userId: number, limit = 50) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT id, title, message, notification_type AS type, reference_type AS referenceType,
            reference_id AS referenceId, is_read AS isRead,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
     FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((row) => ({ ...row, isRead: Boolean(row.isRead) }));
}

export async function getUnreadNotificationCount(userId: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    'SELECT COUNT(*) AS unreadCount FROM notifications WHERE user_id = ? AND is_read = FALSE',
    [userId],
  );
  return Number(rows[0]?.unreadCount ?? 0);
}

export async function markNotificationAsRead(userId: number, notificationId: number) {
  const [result] = await getDatabasePool().execute(
    'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
    [notificationId, userId],
  );
  return (result as { affectedRows: number }).affectedRows > 0;
}

export async function markAllNotificationsAsRead(userId: number) {
  const [result] = await getDatabasePool().execute(
    'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
    [userId],
  );
  return (result as { affectedRows: number }).affectedRows;
}
