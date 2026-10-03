import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import {
  analyticsService,
  type AnalyticsOverview,
  type AnalyticsPeriod,
  type CountBreakdown,
  type StoredManagementInsight,
} from '../../services/analytics.service';

const periods: Array<{ value: AnalyticsPeriod; label: string }> = [
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'last_90_days', label: 'Last 90 Days' },
];

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 401) return 'Your session expired. Sign in again.';
    if (error.response?.status === 403) return 'Admin access is required to view academy intelligence.';
    return error.response?.data.message || fallback;
  }
  return fallback;
}

function Breakdown({ title, items, priority = false }: { title: string; items: CountBreakdown[]; priority?: boolean }) {
  const maximum = Math.max(1, ...items.map((item) => item.total));
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-[var(--color-text)]">{title}</h3>
      {items.length === 0 ? <p className="mt-4 text-sm text-[var(--color-muted)]">No data recorded for this period.</p> : (
        <div className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="text-[var(--color-text)]">{titleCase(item.label)}</span><span className="font-medium text-[var(--color-text)]">{item.total}</span></div>
              <div className="h-2.5 overflow-hidden rounded-full bg-[var(--color-vanilla)]"><div className={`h-full rounded-full ${priority && ['high', 'urgent'].includes(item.label) ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-green)]'}`} style={{ width: `${Math.max(2, (item.total / maximum) * 100)}%` }} /></div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function AdminAIInsightsPage() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('last_7_days');
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [selectedInsight, setSelectedInsight] = useState<StoredManagementInsight | null>(null);
  const [history, setHistory] = useState<StoredManagementInsight[]>([]);
  const [historyError, setHistoryError] = useState('');

  const refreshData = async () => {
    setIsLoading(true);
    setAnalyticsError('');
    try {
      const response = await analyticsService.getOverview(period);
      setAnalytics(response.data.analytics);
    } catch (error) {
      setAnalyticsError(errorMessage(error, 'Live analytics could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  };

  const refreshHistory = async () => {
    try {
      const response = await analyticsService.getInsightHistory();
      setHistory(response.data.insights);
      setHistoryError('');
    } catch (error) {
      setHistoryError(errorMessage(error, 'Previous insights could not be loaded.'));
    }
  };

  useEffect(() => { void refreshData(); }, [period]);
  useEffect(() => { void refreshHistory(); }, []);

  const generateInsights = async () => {
    setIsGenerating(true);
    setGenerationError('');
    try {
      const response = await analyticsService.generateInsights(period);
      setSelectedInsight(response.data.insight);
      setHistory((current) => [response.data.insight, ...current.filter((item) => item.id !== response.data.insight.id)]);
    } catch (error) {
      setGenerationError(errorMessage(error, 'Groq insights could not be generated. No insight was saved.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const selectInsight = async (insight: StoredManagementInsight) => {
    try {
      const response = await analyticsService.getInsight(insight.id);
      setSelectedInsight(response.data.insight);
      setGenerationError('');
    } catch (error) {
      setGenerationError(errorMessage(error, 'The selected insight could not be loaded.'));
    }
  };

  const maximumTrend = Math.max(1, ...(analytics?.trends.map((item) => item.total) ?? []));

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="AI Insights" subtitle="Live support analytics and management intelligence." action={<div className="flex flex-wrap items-center gap-2"><select aria-label="Analytics period" value={period} onChange={(event) => setPeriod(event.target.value as AnalyticsPeriod)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]">{periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Button variant="outline" onClick={() => void refreshData()} loading={isLoading}><RefreshCw className="h-4 w-4" /> Refresh Data</Button></div>} />

      {analyticsError ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{analyticsError}</p> : null}
      {isLoading && !analytics ? <p role="status" className="mb-4 text-sm text-[var(--color-muted)]">Loading live analytics from MySQL...</p> : null}
      {analytics && analytics.totalTickets === 0 ? <div className="mb-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-sm text-[var(--color-muted)]">No complaint data available yet for {periods.find((item) => item.value === period)?.label.toLowerCase()}.</div> : null}

      {analytics ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4"><p className="text-sm text-[var(--color-muted)]">Tickets in period</p><p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{analytics.totalTickets}</p></Card>
            <Card className="p-4"><p className="text-sm text-[var(--color-muted)]">Current open</p><p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{analytics.openComplaints}</p></Card>
            <Card className="p-4"><p className="text-sm text-[var(--color-muted)]">High / urgent unresolved</p><p className="mt-2 text-2xl font-bold text-[var(--color-primary)]">{analytics.highPriorityComplaints}</p></Card>
            <Card className="p-4"><p className="text-sm text-[var(--color-muted)]">Resolved / closed</p><p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{analytics.resolvedComplaints}</p></Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Breakdown title="Ticket Status" items={analytics.status} />
            <Breakdown title="Priority" items={analytics.priorities} priority />
            <Breakdown title="Category" items={analytics.categories} />
            <Breakdown title="Sentiment" items={analytics.sentiments} />
          </div>

          <Card className="mt-5 p-5">
            <h3 className="font-semibold text-[var(--color-text)]">Department Workload</h3>
            {analytics.departments.length === 0 ? <p className="mt-4 text-sm text-[var(--color-muted)]">No departments are configured.</p> : <div className="mt-4 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]"><th className="pb-3 pr-4 font-medium">Department</th><th className="pb-3 pr-4 font-medium">Total</th><th className="pb-3 pr-4 font-medium">Open</th><th className="pb-3 pr-4 font-medium">In Progress</th><th className="pb-3 font-medium">Resolved</th></tr></thead><tbody>{analytics.departments.map((item) => <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0"><td className="py-3 pr-4 text-[var(--color-text)]">{titleCase(item.department)}</td><td className="py-3 pr-4">{item.total}</td><td className="py-3 pr-4">{item.open}</td><td className="py-3 pr-4">{item.inProgress}</td><td className="py-3">{item.resolved}</td></tr>)}</tbody></table></div>}
          </Card>

          <Card className="mt-5 p-5">
            <h3 className="font-semibold text-[var(--color-text)]">Complaint Trend · {periods.find((item) => item.value === period)?.label}</h3>
            {analytics.trends.length === 0 ? <p className="mt-4 text-sm text-[var(--color-muted)]">No ticket creation dates are available for this period.</p> : <div className="mt-4 space-y-3">{analytics.trends.map((item) => <div key={item.date} className="grid grid-cols-[6rem_1fr_2rem] items-center gap-3 text-sm"><span className="text-[var(--color-muted)]">{item.date}</span><div className="h-3 overflow-hidden rounded-full bg-[var(--color-vanilla)]"><div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.max(2, item.total / maximumTrend * 100)}%` }} /></div><span className="text-right font-medium text-[var(--color-text)]">{item.total}</span></div>)}</div>}
          </Card>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <Card className="p-5"><h3 className="font-semibold text-[var(--color-text)]">Resolution Performance</h3><div className="mt-4 grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-[var(--color-muted)]">Resolved tickets in period</p><p className="mt-1 text-xl font-bold text-[var(--color-text)]">{analytics.resolution.resolvedTickets}</p></div><div><p className="text-xs text-[var(--color-muted)]">Current open</p><p className="mt-1 text-xl font-bold text-[var(--color-text)]">{analytics.resolution.activeStatuses.find((item) => item.label === 'open')?.total ?? 0}</p></div><div><p className="text-xs text-[var(--color-muted)]">Current in progress</p><p className="mt-1 text-xl font-bold text-[var(--color-text)]">{analytics.resolution.activeStatuses.find((item) => item.label === 'in_progress')?.total ?? 0}</p></div></div>{analytics.resolution.averageResolutionHours === null ? <p className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm text-[var(--color-muted)]">Not enough resolution history to calculate average resolution time. A ticket must have a recorded resolved/closed status transition.</p> : <p className="mt-4 text-sm text-[var(--color-muted)]">Average resolution time: <span className="font-semibold text-[var(--color-text)]">{analytics.resolution.averageResolutionHours.toFixed(1)} hours</span></p>}</Card>

            <Card className="p-5"><h3 className="font-semibold text-[var(--color-text)]">Top Recurring Issues</h3>{analytics.recurringIssues.length === 0 ? <p className="mt-4 text-sm text-[var(--color-muted)]">No ticket categories are present in this period.</p> : <ol className="mt-4 space-y-3">{analytics.recurringIssues.slice(0, 5).map((item, index) => <li key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3 last:border-0"><span className="text-sm text-[var(--color-text)]"><span className="mr-3 text-[var(--color-muted)]">{index + 1}.</span>{titleCase(item.label)}</span><span className="text-sm font-semibold text-[var(--color-text)]">{item.total}</span></li>)}</ol>}</Card>
          </div>

          <Card className="mt-5 p-5"><div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-[var(--color-primary)]" /><h3 className="font-semibold text-[var(--color-text)]">Needs Attention</h3></div>{analytics.needsAttention.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No high/urgent unresolved tickets found for this period.</p> : <div className="divide-y divide-[var(--color-border)]">{analytics.needsAttention.map((ticket) => <Link key={ticket.ticketNumber} to={`/admin/complaints?ticket=${encodeURIComponent(ticket.ticketNumber)}`} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><span><span className="font-semibold text-[var(--color-text)]">{ticket.ticketNumber}</span><span className="ml-2 text-sm text-[var(--color-muted)]">{ticket.category || 'Uncategorized'} · {ticket.department || 'Unassigned'} · {ticket.studentName} · {new Date(ticket.createdAt).toLocaleDateString()}</span></span><span className="flex items-center gap-2"><StatusBadge label={ticket.priority.toUpperCase()} tone="warning" /><StatusBadge label={titleCase(ticket.status)} /></span></Link>)}</div>}</Card>
        </>
      ) : null}

      <section className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="text-lg font-semibold text-[var(--color-text)]">AI Management Summary</h2></div><p className="mt-1 text-sm text-[var(--color-muted)]">Groq receives aggregated counts only; no student names, IDs, or message text.</p></div><Button variant="primary" onClick={() => void generateInsights()} loading={isGenerating} disabled={!analytics || isLoading}>Generate AI Insights</Button></div>
          {isGenerating ? <p role="status" className="mt-4 text-sm text-[var(--color-muted)]">Generating insights from current database analytics...</p> : null}
          {generationError ? <p role="alert" className="mt-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{generationError}</p> : null}
          {selectedInsight ? <div className="mt-5 space-y-4"><div className="flex flex-wrap items-center gap-2"><StatusBadge label={selectedInsight.provider} /><StatusBadge label={selectedInsight.model} /><StatusBadge label={periods.find((item) => item.value === selectedInsight.period)?.label ?? selectedInsight.period} /></div><p className="text-sm leading-6 text-[var(--color-text)]">{selectedInsight.summary}</p><div className="grid gap-4 md:grid-cols-2"><div><h3 className="text-sm font-semibold text-[var(--color-text)]">Key Issues</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">{selectedInsight.keyIssues.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div><h3 className="text-sm font-semibold text-[var(--color-text)]">Risk Areas</h3>{selectedInsight.riskAreas.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">{selectedInsight.riskAreas.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-muted)]">No risk areas identified in this snapshot.</p>}</div></div><div><h3 className="text-sm font-semibold text-[var(--color-text)]">Recommendations</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">{selectedInsight.recommendations.map((item, index) => <li key={index}>{item}</li>)}</ul></div><div className="rounded-xl border border-[var(--color-primary)]/40 bg-[var(--color-background)] p-4"><h3 className="text-sm font-semibold text-[var(--color-text)]">Priority Action</h3><p className="mt-1 text-sm text-[var(--color-muted)]">{selectedInsight.priorityAction}</p></div><p className="text-xs text-[var(--color-muted)]">Generated {new Date(selectedInsight.generatedAt).toLocaleString()}</p></div> : !isGenerating && !generationError ? <p className="mt-5 text-sm text-[var(--color-muted)]">Generate an on-demand summary using the currently displayed database aggregates.</p> : null}
        </Card>

        <Card className="p-5"><h2 className="font-semibold text-[var(--color-text)]">Previous Insights</h2>{historyError ? <p role="alert" className="mt-3 text-sm text-[var(--color-primary)]">{historyError}</p> : null}{history.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted)]">No saved management insights yet.</p> : <div className="mt-3 divide-y divide-[var(--color-border)]">{history.map((insight) => <button key={insight.id} type="button" onClick={() => void selectInsight(insight)} className="block w-full py-3 text-left first:pt-0"><span className="flex items-center justify-between gap-3"><span className="text-xs text-[var(--color-muted)]">{new Date(insight.generatedAt).toLocaleString()}</span><span className="text-xs text-[var(--color-muted)]">{periods.find((item) => item.value === insight.period)?.label}</span></span><span className="mt-1 block line-clamp-2 text-sm text-[var(--color-text)]">{insight.summary}</span></button>)}</div>}</Card>
      </section>
    </div>
  );
}
