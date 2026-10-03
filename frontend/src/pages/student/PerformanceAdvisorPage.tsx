import axios from 'axios';
import { Activity, BookOpenCheck, BrainCircuit, CheckCircle2, CircleAlert, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { ProgressBar } from '../../components/ProgressBar';
import { StatusBadge } from '../../components/StatusBadge';
import { studentDashboardService, type PerformanceAdvisor } from '../../services/studentDashboard.service';

export function PerformanceAdvisorPage() {
  const [analysis, setAnalysis] = useState<PerformanceAdvisor | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');

  const refresh = async () => {
    setIsLoading(true);
    setError('');
    setEmptyMessage('');
    try {
      const response = await studentDashboardService.generatePerformanceAdvisor();
      if (response.data.available) {
        setAnalysis(response.data.advisor);
      } else {
        setAnalysis(null);
        setEmptyMessage(response.data.message);
      }
    } catch (cause) {
      setError(axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data.message ?? 'The AI Performance Advisor could not complete the analysis.' : 'The AI Performance Advisor could not complete the analysis.');
    } finally {
      setIsLoading(false);
    }
  };

  const listCard = (title: string, items: string[], icon: React.ReactNode) => (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 text-[var(--color-green)]">{icon}<h2 className="font-semibold text-[var(--color-text)]">{title}</h2></div>
      {items.length ? <ul className="space-y-2">{items.map((item, index) => <li key={`${title}-${index}`} className="rounded-xl bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{item}</li>)}</ul> : <p className="text-sm text-[var(--color-muted)]">No items identified from the available records.</p>}
    </Card>
  );

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader
        title="AI Performance Advisor"
        subtitle="A private, on-demand review based only on your recorded courses, learning activity, tasks, attendance, and schedule."
        action={<Button variant="primary" loading={isLoading} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /> Refresh AI Analysis</Button>}
      />
      {error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}
      {isLoading ? <p role="status" className="mb-4 text-sm text-[var(--color-muted)]">Preparing your academic snapshot and requesting a fresh Groq analysis...</p> : null}
      {emptyMessage ? <Card className="mb-5 p-5"><div className="flex items-start gap-3"><CircleAlert className="mt-0.5 h-5 w-5 text-[var(--color-primary)]" /><div><h2 className="font-semibold">More learning activity is needed</h2><p className="mt-1 text-sm text-[var(--color-muted)]">{emptyMessage}</p></div></div></Card> : null}
      {!analysis && !isLoading && !emptyMessage && !error ? <Card className="p-8 text-center"><BrainCircuit className="mx-auto h-9 w-9 text-[var(--color-primary)]" /><h2 className="mt-3 font-semibold">Your advisor is ready</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Generate an analysis when you want one. It does not run continuously.</p></Card> : null}
      {analysis ? <>
        <Card className="mb-5 border-l-4 border-l-[var(--color-primary)] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-[var(--color-primary)]" /><h2 className="text-lg font-semibold">Your learning overview</h2></div><div className="flex gap-2"><StatusBadge label={analysis.provider} /><StatusBadge label={analysis.model} /></div></div><p className="mt-3 text-sm leading-6 text-[var(--color-text)]">{analysis.overallSummary}</p></Card>
        <div className="mb-5 grid gap-5 lg:grid-cols-2">
          {listCard('Strengths', analysis.strengths, <CheckCircle2 className="h-4 w-4" />)}
          {listCard('Areas to improve', analysis.areasToImprove, <Activity className="h-4 w-4" />)}
          {listCard('Priority actions', analysis.priorityActions, <CircleAlert className="h-4 w-4" />)}
          {listCard('Study focus', analysis.studyFocus, <BookOpenCheck className="h-4 w-4" />)}
        </div>
        <div className="mb-5 grid gap-5 md:grid-cols-2"><Card className="p-5"><h2 className="font-semibold">Attendance insight</h2><p className="mt-2 text-sm text-[var(--color-muted)]">{analysis.attendanceInsight}</p></Card><Card className="p-5"><h2 className="font-semibold">Task insight</h2><p className="mt-2 text-sm text-[var(--color-muted)]">{analysis.taskInsight}</p></Card></div>
        <Card className="mb-5 p-5"><h2 className="mb-3 font-semibold">Course insights</h2>{analysis.courseInsights.length ? <div className="grid gap-4 md:grid-cols-2">{analysis.courseInsights.map((item) => <div key={item.courseName} className="rounded-xl border border-[var(--color-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{item.courseName}</h3>{item.progress === null ? <StatusBadge label="Progress not recorded" /> : <span className="text-sm font-semibold">{item.progress}%</span>}</div>{item.progress !== null ? <ProgressBar value={item.progress} label="Recorded course progress" /> : null}<p className="mt-2 text-sm text-[var(--color-muted)]">{item.insight}</p></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No course-specific insights are available.</p>}</Card>
        <Card className="p-5"><h2 className="mb-3 font-semibold">Recommended recorded resources</h2>{analysis.recommendedResources.length ? <div className="grid gap-3 md:grid-cols-2">{analysis.recommendedResources.map((resource, index) => <div key={`${resource.courseName}-${resource.title}-${index}`} className="rounded-xl bg-[var(--color-background)] p-4"><p className="font-medium">{resource.title}</p><p className="text-xs text-[var(--color-muted)]">{resource.courseName}</p><p className="mt-2 text-sm text-[var(--color-muted)]">{resource.reason}</p></div>)}</div> : <p className="text-sm text-[var(--color-muted)]">No matching learning resources are currently recorded for your courses.</p>}</Card>
      </> : null}
    </div>
  );
}
