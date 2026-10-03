import axios from 'axios';
import { Bell, Check, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  notificationsService,
  type NotificationRecord,
  type NotificationRole,
} from '../services/notifications.service';

function destination(role: NotificationRole, notification: NotificationRecord) {
  if (role === 'ADMIN') {
    if (notification.type === 'COMPLAINT') return '/admin/complaints';
    if (notification.type === 'INTERNSHIP') return '/admin/management?tab=internships';
    if (notification.type === 'PAYMENT') return '/admin/payments';
    if (notification.type === 'AI_INSIGHT') return '/admin/ai-insights';
    return '/admin/dashboard';
  }
  if (notification.type === 'ANNOUNCEMENT') return '/student/announcements';
  if (notification.type === 'CLASS') return '/student/schedule';
  if (notification.type === 'PAYMENT') return '/student/payments';
  if (notification.type === 'TASK') return '/student/learning';
  if (notification.type === 'COMPLAINT') return '/student/complaints';
  if (notification.type === 'CERTIFICATE') return '/student/certificates';
  if (notification.type === 'INTERNSHIP') return '/student/internships';
  return '/student/dashboard';
}

function notificationTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Recently' : date.toLocaleString();
}

export function NotificationBell({ role }: { role: NotificationRole }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await notificationsService.get(role);
      setNotifications(response.data.notifications.slice(0, 6));
      setUnreadCount(response.data.unreadCount);
      setError('');
    } catch (cause) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Notifications could not be loaded.' : 'Notifications could not be loaded.');
    }
  }, [role]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const openNotification = async (notification: NotificationRecord) => {
    if (!notification.isRead) {
      try {
        await notificationsService.markRead(role, notification.id);
        setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, isRead: true } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (cause) {
        setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Notification could not be marked as read.' : 'Notification could not be marked as read.');
        return;
      }
    }
    setIsOpen(false);
    navigate(destination(role, notification));
  };

  const markAllRead = async () => {
    setIsLoading(true);
    setError('');
    try {
      await notificationsService.markAllRead(role);
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (cause) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'Notifications could not be marked as read.' : 'Notifications could not be marked as read.');
    } finally {
      setIsLoading(false);
    }
  };

  const pagePath = role === 'ADMIN' ? '/admin/notifications' : '/student/notifications';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setIsOpen((open) => !open); if (!isOpen) void refresh(); }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
        className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 text-[var(--color-text)]"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[var(--color-primary)] px-1 text-center text-xs font-semibold leading-5 text-white">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>
      {isOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold text-[var(--color-text)]">Notifications</h2>
            <button type="button" disabled={isLoading || unreadCount === 0} onClick={() => void markAllRead()} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-green)] disabled:opacity-50">
              {isLoading ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Mark all read
            </button>
          </div>
          {error ? <p role="alert" className="mb-2 text-xs text-[var(--color-primary)]">{error}</p> : null}
          {notifications.length ? <div className="max-h-80 space-y-1 overflow-y-auto">{notifications.map((notification) => (
            <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`block w-full rounded-xl p-2 text-left hover:bg-[var(--color-background)] ${notification.isRead ? '' : 'bg-[var(--color-background)]/70'}`}>
              <span className="flex items-start justify-between gap-2"><strong className="text-sm text-[var(--color-text)]">{notification.title}</strong>{!notification.isRead ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-primary)]" aria-label="Unread" /> : null}</span>
              <span className="mt-1 block line-clamp-2 text-xs text-[var(--color-muted)]">{notification.message}</span>
              <span className="mt-1 block text-[10px] text-[var(--color-muted)]">{notification.type.replaceAll('_', ' ')} · {notificationTime(notification.createdAt)}</span>
            </button>
          ))}</div> : !error ? <p className="py-5 text-center text-sm text-[var(--color-muted)]">No notifications yet.</p> : null}
          <button type="button" onClick={() => { setIsOpen(false); navigate(pagePath); }} className="mt-2 w-full border-t border-[var(--color-border)] pt-3 text-sm font-semibold text-[var(--color-green)]">View all notifications</button>
        </div>
      ) : null}
    </div>
  );
}
