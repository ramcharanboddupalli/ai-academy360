import axios from 'axios';
import { Bell, Check, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';
import {
  notificationsService,
  type NotificationRecord,
  type NotificationRole,
} from '../services/notifications.service';

function notificationPath(role: NotificationRole, notification: NotificationRecord) {
  if (role === 'ADMIN') {
    return notification.type === 'COMPLAINT' ? '/admin/complaints'
      : notification.type === 'INTERNSHIP' ? '/admin/management?tab=internships'
        : notification.type === 'PAYMENT' ? '/admin/payments'
          : notification.type === 'AI_INSIGHT' ? '/admin/ai-insights'
            : '/admin/dashboard';
  }
  return notification.type === 'ANNOUNCEMENT' ? '/student/announcements'
    : notification.type === 'CLASS' ? '/student/schedule'
      : notification.type === 'PAYMENT' ? '/student/payments'
        : notification.type === 'TASK' ? '/student/learning'
          : notification.type === 'COMPLAINT' ? '/student/complaints'
            : notification.type === 'CERTIFICATE' ? '/student/certificates'
              : notification.type === 'INTERNSHIP' ? '/student/internships'
                : '/student/dashboard';
}

export function NotificationsPage({ role }: { role: NotificationRole }) {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await notificationsService.get(role);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (cause) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Notifications could not be loaded.' : 'Notifications could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (id: number | string) => {
    setIsSaving(true);
    setError('');
    try {
      await notificationsService.markRead(role, id);
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (cause) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Notification could not be marked as read.' : 'Notification could not be marked as read.');
    } finally {
      setIsSaving(false);
    }
  };

  const markAllRead = async () => {
    setIsSaving(true);
    setError('');
    try {
      await notificationsService.markAllRead(role);
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (cause) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Notifications could not be marked as read.' : 'Notifications could not be marked as read.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`}
        action={<button type="button" disabled={isSaving || unreadCount === 0} onClick={() => void markAllRead()} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm font-medium disabled:opacity-50"><Check className="h-4 w-4" /> Mark all as read</button>}
      />
      {error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}
      {isLoading ? <p role="status" className="mb-4 text-sm text-[var(--color-muted)]">Loading notifications...</p> : null}
      {!isLoading && !error && notifications.length === 0 ? <Card className="p-8 text-center"><Bell className="mx-auto h-8 w-8 text-[var(--color-muted)]" /><p className="mt-3 text-sm text-[var(--color-muted)]">No notifications yet.</p></Card> : null}
      {notifications.length ? <div className="space-y-3">{notifications.map((notification) => (
        <Card key={notification.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${notification.isRead ? '' : 'border-l-4 border-l-[var(--color-primary)]'}`}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[var(--color-text)]">{notification.title}</h2><span className="rounded-full bg-[var(--color-background)] px-2 py-1 text-[10px] font-medium text-[var(--color-muted)]">{notification.type.replaceAll('_', ' ')}</span>{!notification.isRead ? <span className="text-xs font-medium text-[var(--color-primary)]">Unread</span> : null}</div>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{notification.message}</p>
            <p className="mt-2 text-xs text-[var(--color-muted)]">{new Date(notification.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!notification.isRead ? <button type="button" disabled={isSaving} onClick={() => void markRead(notification.id)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs font-medium disabled:opacity-50"><LoaderCircle className={`h-3 w-3 ${isSaving ? 'animate-spin' : 'hidden'}`} /> Mark read</button> : null}
            <Link to={notificationPath(role, notification)} className="rounded-lg bg-[var(--color-green)] px-3 py-2 text-xs font-medium text-white" onClick={() => { if (!notification.isRead) void markRead(notification.id); }}>Open</Link>
          </div>
        </Card>
      ))}</div> : null}
    </div>
  );
}
