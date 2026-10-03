import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, BookOpenCheck, CalendarDays, ClipboardList, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LearningAdvisorPanel } from '../../components/LearningAdvisorPanel';
import { Card } from '../../components/Card';
import { MetricCard } from '../../components/MetricCard';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type StudentDashboard } from '../../services/studentDashboard.service';

export function StudentDashboardPage() {
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    studentDashboardService.getDashboard()
      .then((response) => { if (isMounted) setDashboard(response.data.dashboard); })
      .catch((cause: unknown) => {
        if (isMounted) setError(axios.isAxiosError(cause) && cause.response?.status === 401 ? 'Your session has expired. Sign in again.' : 'Your dashboard could not be loaded.');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const studentName = dashboard?.student.fullName ?? 'Student';
  const progressLabel = dashboard?.overallProgress === null || dashboard?.overallProgress === undefined ? 'Not recorded' : `${dashboard.overallProgress}%`;
  const attendanceLabel = dashboard?.attendancePercent === null || dashboard?.attendancePercent === undefined ? 'Not recorded' : `${dashboard.attendancePercent}%`;

  return (
    <div className="min-w-0 p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted)]">Student overview</p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--color-text)]">Welcome, {studentName}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">{dashboard ? `Student ID: ${dashboard.student.studentId} · Joined ${dashboard.student.joinDate}` : 'Your authenticated student overview.'}</p>
        </div>
        <Link to="/student/profile" className="text-sm font-medium text-[var(--color-primary)]">My Profile <ArrowRight className="ml-1 inline h-4 w-4" /></Link>
      </div>

      {isLoading ? <p role="status" className="mb-5 text-sm text-[var(--color-muted)]">Loading your student dashboard...</p> : null}
      {error ? <p role="alert" className="mb-5 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{error}</p> : null}

      {dashboard ? <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active Courses" value={String(dashboard.activeCourseCount)} note="From your active enrollments" icon={<GraduationCap className="h-4 w-4" />} />
          <MetricCard label="Overall Progress" value={progressLabel} note={dashboard.overallProgress === null ? 'No progress records' : 'Across recorded course progress'} icon={<BookOpenCheck className="h-4 w-4" />} />
          <MetricCard label="Attendance" value={attendanceLabel} note={dashboard.attendancePercent === null ? 'No attendance records' : 'From recorded classes'} icon={<CalendarDays className="h-4 w-4" />} />
          <MetricCard label="Pending Tasks" value={String(dashboard.pendingTasks)} note="Assigned learning tasks not completed" icon={<ClipboardList className="h-4 w-4" />} />
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--color-text)]">Continue Learning</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Your enrolled courses and recorded progress.</p></div><Link to="/student/courses" className="text-sm font-medium text-[var(--color-primary)]">My Courses</Link></div>
            {dashboard.courses.length ? <div className="space-y-3">{dashboard.courses.map((course) => <div key={course.id} className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-medium text-[var(--color-text)]">{course.name}</h3><p className="mt-1 text-sm text-[var(--color-muted)]">{course.progress === null ? 'No progress recorded yet' : `${course.progress}% recorded progress`}</p></div><StatusBadge label={course.status === 'completed' ? 'Completed' : 'Active'} tone={course.status === 'completed' ? 'success' : 'info'} /></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No courses have been assigned to your account yet.</p>}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text)]">Today and Upcoming Classes</h2></div>
            {dashboard.todayAndUpcomingClasses.length ? <div className="space-y-3">{dashboard.todayAndUpcomingClasses.map((item) => <div key={item.id} className="rounded-xl border border-[var(--color-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium text-[var(--color-text)]">{item.course} · {item.title}</h3><StatusBadge label={item.status} /></div><p className="mt-2 text-sm text-[var(--color-muted)]">{new Date(item.startsAt).toLocaleString()} – {new Date(item.endsAt).toLocaleTimeString()}</p>{item.instructor ? <p className="mt-1 text-sm text-[var(--color-muted)]">{item.instructor}</p> : null}</div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No upcoming classes scheduled.</p>}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold text-[var(--color-text)]">Recent Announcements</h2><Link to="/student/announcements" className="text-sm font-medium text-[var(--color-primary)]">View all</Link></div>
            {dashboard.recentAnnouncements.length ? <div className="divide-y divide-[var(--color-border)]">{dashboard.recentAnnouncements.map((item) => <article key={item.id} className="py-3 first:pt-0"><div className="flex items-center justify-between gap-3"><h3 className="font-medium text-[var(--color-text)]">{item.title}</h3><StatusBadge label={item.isRead ? 'Read' : 'Unread'} tone={item.isRead ? 'info' : 'warning'} /></div><p className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{item.message}</p></article>)}</div> : <p className="text-sm text-[var(--color-muted)]">No announcements yet.</p>}
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold text-[var(--color-text)]">Support Status</h2><Link to="/student/complaints" className="text-sm font-medium text-[var(--color-primary)]">Ticket history</Link></div>
            <p className="text-sm text-[var(--color-muted)]">{dashboard.support.activeTickets} active of {dashboard.support.totalTickets} support tickets.</p>
            {dashboard.support.recentTickets.length ? <div className="mt-3 space-y-2">{dashboard.support.recentTickets.map((ticket) => <Link key={ticket.ticketNumber} to="/student/complaints" className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3 text-sm"><span className="font-medium text-[var(--color-text)]">{ticket.ticketNumber} · {ticket.title}</span><StatusBadge label={ticket.status.replaceAll('_', ' ')} /></Link>)}</div> : <p className="mt-2 text-sm text-[var(--color-muted)]">No support tickets yet.</p>}
            <Link to="/student/support" className="mt-4 inline-flex items-center text-sm font-medium text-[var(--color-primary)]">Open Support Center <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Card>
        </div>

        <div className="mt-6"><LearningAdvisorPanel hasActivity={dashboard.learningActivityAvailable} /></div>
      </> : null}
    </div>
  );
}