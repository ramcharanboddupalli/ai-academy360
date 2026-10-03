import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowRight, BellRing, BookOpen, CalendarDays, CircleDollarSign, ClipboardList, MessageSquareText, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/Card';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { adminService, type AdminDashboardSummary } from '../../services/admin.service';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number) {
  return `${Number(value).toFixed(2)}%`;
}

export function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState<AdminDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    adminService.getDashboard()
      .then((response) => {
        if (!isMounted) return;
        setDashboard(response.data.dashboard);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setErrorMessage(axios.isAxiosError(error) && error.response?.status === 403
          ? 'Admin access is required to load academy metrics.'
          : 'Dashboard metrics could not be loaded. Check your connection and try again.');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const cards = useMemo(() => dashboard ? [
    { label: 'Total Students', value: formatNumber(dashboard.totalStudents), note: 'Live student records', icon: <Users className="h-4 w-4" /> },
    { label: 'Active Students', value: formatNumber(dashboard.activeStudents), note: 'Currently active', icon: <Users className="h-4 w-4" /> },
    { label: 'Total Courses', value: formatNumber(dashboard.totalCourses), note: 'Catalog courses', icon: <BookOpen className="h-4 w-4" /> },
    { label: 'Active Enrollments', value: formatNumber(dashboard.activeEnrollments), note: 'Current enrollments', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Total Fees Collected', value: formatCurrency(dashboard.totalFeesCollected), note: 'Paid revenue', icon: <CircleDollarSign className="h-4 w-4" /> },
    { label: 'Pending Fees', value: formatCurrency(dashboard.pendingFees), note: 'Awaiting payment', icon: <CircleDollarSign className="h-4 w-4" /> },
    { label: 'Upcoming Classes', value: formatNumber(dashboard.upcomingClasses), note: 'Scheduled next', icon: <CalendarDays className="h-4 w-4" /> },
    { label: 'Open Support Tickets', value: formatNumber(dashboard.openSupportTickets), note: 'Awaiting review', icon: <MessageSquareText className="h-4 w-4" /> },
    { label: 'Average Course Progress', value: formatPercent(dashboard.averageCourseProgress), note: 'Across all enrollments', icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Average Attendance', value: formatPercent(dashboard.averageAttendance), note: 'Class attendance', icon: <TrendingUp className="h-4 w-4" /> },
    { label: 'Active Learning Tasks', value: formatNumber(dashboard.activeLearningTasks), note: 'In progress', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'Completed Tasks', value: formatNumber(dashboard.completedTasks), note: 'Finished tasks', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'High Priority Tickets', value: formatNumber(dashboard.highPriorityTickets), note: 'Urgent attention', icon: <BellRing className="h-4 w-4" /> },
    { label: 'In Progress', value: formatNumber(dashboard.inProgress), note: 'Currently active tickets', icon: <BellRing className="h-4 w-4" /> },
    { label: 'Resolved', value: formatNumber(dashboard.resolved), note: 'Closed and resolved', icon: <MessageSquareText className="h-4 w-4" /> },
    { label: 'This Month', value: formatCurrency(dashboard.thisMonth), note: 'Collected this month', icon: <CircleDollarSign className="h-4 w-4" /> },
    { label: 'This Year', value: formatCurrency(dashboard.thisYear), note: 'Collected this year', icon: <CircleDollarSign className="h-4 w-4" /> },
  ] : [], [dashboard]);

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Admin Dashboard" subtitle="Operations overview and support signals." action={<Link to="/admin/ai-insights" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 text-sm font-medium text-[var(--color-text)]">AI Insights <ArrowRight className="h-4 w-4" /></Link>} />

      {errorMessage ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}
      {isLoading ? <div role="status" className="mb-4 text-sm text-[var(--color-muted)]">Loading live academy metrics...</div> : null}

      {dashboard ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <MetricCard key={card.label} label={card.label} value={String(card.value)} note={card.note} icon={card.icon} />)}</div> : null}

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Operations snapshot</h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Real MySQL counts and payment totals for the current academy state.</p>
          </div>
          <Link to="/admin/complaints" className="text-sm font-medium text-[var(--color-primary)]">All complaints</Link>
        </div>

        {dashboard ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="New Students" value={formatNumber(dashboard.newStudents)} note="Last 30 days" icon={<Users className="h-4 w-4" />} />
          <MetricCard label="Inactive Students" value={formatNumber(dashboard.inactiveStudents)} note="Need re-engagement" icon={<Users className="h-4 w-4" />} />
          <MetricCard label="Recent Enrollments" value={formatNumber(dashboard.recentEnrollments)} note="Last 30 days" icon={<ClipboardList className="h-4 w-4" />} />
          <MetricCard label="Pending Revenue" value={formatCurrency(dashboard.pendingRevenue)} note="Outstanding" icon={<CircleDollarSign className="h-4 w-4" />} />
          <MetricCard label="Overdue Revenue" value={formatCurrency(dashboard.overdueRevenue)} note="Pending past due date" icon={<CircleDollarSign className="h-4 w-4" />} />
        </div> : null}
      </Card>
    </div>
  );
}
