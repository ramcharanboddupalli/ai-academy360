import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CalendarClock, Clock3, MapPin } from 'lucide-react';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type StudentClass } from '../../services/studentDashboard.service';

function ClassList({ title, items }: { title: string; items: StudentClass[] }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3"><div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><CalendarClock className="h-4 w-4" /></div><h2 className="font-semibold text-[var(--color-text)]">{title}</h2></div>
      {items.length ? <div className="space-y-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-[var(--color-text)]">{item.title}</h3><p className="mt-1 text-sm text-[var(--color-muted)]">{item.course}</p></div><StatusBadge label={item.status} /></div>      <div className="mt-3 space-y-2 text-sm text-[var(--color-muted)]"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[var(--color-primary)]" />{new Date(item.startsAt).toLocaleString()} – {new Date(item.endsAt).toLocaleTimeString()}</div>{item.location ? <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-[var(--color-primary)]" />{item.location}</div> : null}{item.instructor ? <p>Instructor: {item.instructor}</p> : null}</div>{item.meetingUrl ? <a href={item.meetingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)]">Join class</a> : null}{item.recordingAvailable && item.recordingUrl ? <a href={item.recordingUrl} target="_blank" rel="noreferrer" className="ml-4 mt-3 inline-block text-sm font-medium text-[var(--color-primary)]">View recording</a> : null}</article>)}</div> : <p className="text-sm text-[var(--color-muted)]">No upcoming classes scheduled.</p>}
    </Card>
  );
}

export function StudentSchedulePage() {
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentDashboardService.getSchedule()
      .then((response) => { if (isMounted) setClasses(response.data.classes); })
      .catch((cause: unknown) => { if (isMounted) setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Your schedule could not be loaded.'); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const today = new Date().toDateString();
  const todayClasses = useMemo(() => classes.filter((item) => new Date(item.startsAt).toDateString() === today), [classes, today]);
  const upcoming = useMemo(() => classes.filter((item) => new Date(item.startsAt).toDateString() !== today), [classes, today]);

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="Schedule" subtitle="Upcoming classes for your enrolled courses." />
      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading your schedule...</p> : null}
      {error ? <p role="alert" className="mb-5 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {!isLoading && !error && classes.length === 0 ? <p className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">No upcoming classes scheduled.</p> : null}
      <div className="grid gap-5 xl:grid-cols-2"><ClassList title="Today's Classes" items={todayClasses} /><ClassList title="Upcoming Classes" items={upcoming} /></div>
    </div>
  );
}