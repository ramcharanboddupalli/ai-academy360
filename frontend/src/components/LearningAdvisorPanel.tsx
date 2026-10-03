import { useState } from 'react';
import axios from 'axios';
import { Sparkles } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';
import { StatusBadge } from './StatusBadge';
import { studentDashboardService, type LearningAdvisor } from '../services/studentDashboard.service';

export function LearningAdvisorPanel({ hasActivity }: { hasActivity: boolean }) {
  const [advisor, setAdvisor] = useState<LearningAdvisor | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generate = async () => {
    setIsLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await studentDashboardService.generateLearningAdvisor();
      if (!response.data.available) {
        setAdvisor(null);
        setMessage(response.data.message);
      } else {
        setAdvisor(response.data.advisor);
      }
    } catch (cause) {
      setError(axios.isAxiosError(cause) ? cause.response?.data?.message ?? 'The learning insight could not be generated.' : 'The learning insight could not be generated.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold text-[var(--color-text)]">AI Learning Insight</h2></div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Uses your recorded course progress, attendance, tasks, and completed topics.</p>
        </div>
        <Button variant="outline" loading={isLoading} disabled={!hasActivity} onClick={() => void generate()}>Generate insight</Button>
      </div>
      {!hasActivity ? <p className="mt-4 text-sm text-[var(--color-muted)]">Not enough learning activity available yet.</p> : null}
      {message ? <p role="status" className="mt-4 text-sm text-[var(--color-muted)]">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-[var(--color-primary)]">{error}</p> : null}
      {advisor ? (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge label={advisor.provider} /><StatusBadge label={advisor.model} /><StatusBadge label={`Priority: ${advisor.priority}`} tone={advisor.priority === 'high' ? 'warning' : 'info'} /></div>
          <p className="text-sm leading-6 text-[var(--color-text)]">{advisor.summary}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <div><h3 className="text-sm font-semibold text-[var(--color-text)]">Focus areas</h3>{advisor.focusAreas.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">{advisor.focusAreas.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-muted)]">No focus areas supplied.</p>}</div>
            <div><h3 className="text-sm font-semibold text-[var(--color-text)]">Next steps</h3>{advisor.recommendedNextSteps.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-muted)]">{advisor.recommendedNextSteps.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-muted)]">No next steps supplied.</p>}</div>
          </div>
          <p className="text-sm text-[var(--color-muted)]">{advisor.attendanceNote}</p>
        </div>
      ) : null}
    </Card>
  );
}