import { useEffect, useState } from 'react';
import axios from 'axios';
import { Bell } from 'lucide-react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type StudentAnnouncement } from '../../services/studentDashboard.service';

export function StudentAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<StudentAnnouncement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentDashboardService.getAnnouncements()
      .then((response) => { if (isMounted) setAnnouncements(response.data.announcements); })
      .catch((cause: unknown) => { if (isMounted) setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Announcements could not be loaded.'); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const markRead = async (announcement: StudentAnnouncement) => {
    try {
      await studentDashboardService.markAnnouncementRead(announcement.id);
      setAnnouncements((items) => items.map((item) => item.id === announcement.id ? { ...item, isRead: true } : item));
    } catch {
      setError('The announcement could not be marked as read.');
    }
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Announcements" subtitle="Published academy updates for all students and your enrolled courses." />
      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading announcements...</p> : null}
      {error ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {!isLoading && !error && announcements.length === 0 ? <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-sm text-[var(--color-muted)]">No announcements yet.</p> : null}
      <div className="space-y-4">{announcements.map((announcement) => <Card key={announcement.id} className="p-5"><article><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text)]">{announcement.title}</h2></div><div className="flex items-center gap-2"><StatusBadge label={announcement.category} /><StatusBadge label={announcement.isRead ? 'Read' : 'Unread'} tone={announcement.isRead ? 'info' : 'warning'} /></div></div><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-muted)]">{announcement.message}</p><div className="mt-4 flex items-center justify-between gap-3"><time className="text-xs text-[var(--color-muted)]">{new Date(announcement.publishedAt).toLocaleString()}</time>{!announcement.isRead ? <button type="button" onClick={() => void markRead(announcement)} className="text-sm font-medium text-[var(--color-primary)]">Mark as read</button> : null}</div></article></Card>)}</div>
    </div>
  );
}