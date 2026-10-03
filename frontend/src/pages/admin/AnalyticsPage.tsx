import axios from 'axios';
import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { ProgressBar } from '../../components/ProgressBar';
import { analyticsService, type AnalyticsOverview, type AnalyticsPeriod } from '../../services/analytics.service';

const periods: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'last_90_days', label: 'Last 90 days' },
];

export function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('last_30_days');
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await analyticsService.getOverview(period);
      setAnalytics(response.data.analytics);
    } catch (cause) {
      setError(axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data.message ?? 'Live analytics could not be loaded.' : 'Live analytics could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void load(); }, [period]);
  const completionRate = analytics ? Math.round((analytics.resolvedComplaints / Math.max(1, analytics.totalComplaints)) * 100) : 0;
  const activeTickets = analytics ? analytics.status.filter((item) => item.label === 'open' || item.label === 'in_progress' || item.label === 'pending').reduce((total, item) => total + item.total, 0) : 0;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Analytics" subtitle="Live program and support metrics from the academy database." action={<div className="flex gap-2"><select aria-label="Analytics period" value={period} onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm">{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Button variant="outline" loading={isLoading} onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button></div>} />
      {error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}
      {isLoading && !analytics ? <p role="status" className="mb-4 text-sm text-[var(--color-muted)]">Loading analytics from MySQL...</p> : null}
      {analytics ? <>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Students" value={String(analytics.totalStudents)} note="Current student records" icon={<TrendingUp className="h-4 w-4" />} />
          <MetricCard label="Courses" value={String(analytics.totalCourses)} note="Current catalog" icon={<BarChart3 className="h-4 w-4" />} />
          <MetricCard label="Tickets in selected period" value={String(analytics.totalTickets)} note={`${periods.find((item) => item.value === period)?.label}`} icon={<BarChart3 className="h-4 w-4" />} />
          <MetricCard label="Resolved tickets" value={`${completionRate}%`} note={`${analytics.resolvedComplaints} total resolved / closed`} icon={<TrendingUp className="h-4 w-4" />} />
        </div>
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3"><BarChart3 className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">Support performance</h2></div>
          <div className="space-y-5">
            <ProgressBar value={completionRate} label="Resolved / closed tickets" />
            <ProgressBar value={Math.min(100, Math.round((analytics.highPriorityComplaints / Math.max(1, analytics.totalComplaints)) * 100))} label="High-priority open share" color="var(--color-primary)" />
            <p className="text-sm text-[var(--color-muted)]">{activeTickets} tickets currently open, in progress, or pending.</p>
          </div>
        </Card>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {[{ label: 'Status', items: analytics.status }, { label: 'Priority', items: analytics.priorities }, { label: 'Category', items: analytics.categories }, { label: 'Sentiment', items: analytics.sentiments }].map((section) => <Card key={section.label} className="p-5"><h2 className="font-semibold">{section.label}</h2>{section.items.length ? <div className="mt-3 space-y-2">{section.items.map((item) => <div key={item.label} className="flex justify-between border-b border-[var(--color-border)] py-2 text-sm"><span className="capitalize">{item.label.replaceAll('_', ' ')}</span><strong>{item.total}</strong></div>)}</div> : <p className="mt-3 text-sm text-[var(--color-muted)]">No records for this period.</p>}</Card>)}
        </div>
      </> : !isLoading && !error ? <Card className="p-5 text-sm text-[var(--color-muted)]">No analytics are available.</Card> : null}
    </div>
  );
}
