import api from './api';

export type NotificationRole = 'ADMIN' | 'STUDENT';
export type NotificationType =
  | 'ANNOUNCEMENT'
  | 'CLASS'
  | 'PAYMENT'
  | 'TASK'
  | 'COMPLAINT'
  | 'CERTIFICATE'
  | 'INTERNSHIP'
  | 'SYSTEM'
  | 'AI_INSIGHT';

export type NotificationRecord = {
  id: number | string;
  title: string;
  message: string;
  type: NotificationType;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
};

function basePath(role: NotificationRole) {
  return role === 'ADMIN' ? '/admin/notifications' : '/student/notifications';
}

export const notificationsService = {
  get(role: NotificationRole) {
    return api.get<{ success: true; notifications: NotificationRecord[]; unreadCount: number }>(basePath(role));
  },
  markRead(role: NotificationRole, id: number | string) {
    return api.patch<{ success: true }>(`${basePath(role)}/${id}/read`);
  },
  markAllRead(role: NotificationRole) {
    return api.patch<{ success: true; updatedCount: number }>(`${basePath(role)}/read-all`);
  },
};
