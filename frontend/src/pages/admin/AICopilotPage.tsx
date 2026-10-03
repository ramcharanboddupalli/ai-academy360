import axios from 'axios';
import { ArrowRight, BrainCircuit, Lightbulb, LoaderCircle, Send, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { adminCopilotService, type AdminCopilotResponse } from '../../services/adminCopilot.service';

const suggestedQuestions = [
  'How many students are enrolled?',
  'Which courses have the most pending tasks?',
  'Which students have the lowest recorded attendance?',
  'How much revenue was collected this month?',
  'What are the most common complaints this month?',
  'Summarize academy performance for the last 30 days.',
];

export function AdminAICopilotPage() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<AdminCopilotResponse | null>(null);
  const [model, setModel] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const ask = async (event?: FormEvent) => {
    event?.preventDefault();
    if (question.trim().length < 3) {
      setError('Enter a question with at least 3 characters.');
      return;
    }
    setIsLoading(true);
    setError('');
    setAnswer(null);
    try {
      const response = await adminCopilotService.ask(question.trim());
      setAnswer(response.data.response);
      setModel(response.data.model);
    } catch (cause) {
      setError(axios.isAxiosError<{ message?: string }>(cause) ? cause.response?.data.message ?? 'The AI Admin Copilot could not answer this question.' : 'The AI Admin Copilot could not answer this question.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-w-0 p-4 md:p-6">
      <PageHeader title="AI Admin Copilot" subtitle="Ask operational questions. Responses use a bounded snapshot of real academy aggregates and do not execute AI-generated SQL." />
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3"><div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><BrainCircuit className="h-5 w-5" /></div><div><h2 className="font-semibold">Ask about academy operations</h2><p className="mt-1 text-sm text-[var(--color-muted)]">Questions are answered from predefined MySQL queries. Numeric metrics cite the source field used.</p></div></div>
        <form className="mt-4 space-y-3" onSubmit={(event) => void ask(event)}>
          <label htmlFor="copilot-question" className="sr-only">Question</label>
          <textarea id="copilot-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1000} rows={3} placeholder="Ask a question about students, courses, attendance, revenue, or support..." className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
          <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-[var(--color-muted)]">{question.length}/1000 characters</p><Button variant="primary" type="submit" loading={isLoading}><Send className="h-4 w-4" /> Ask Copilot</Button></div>
        </form>
      </Card>
      <div className="mb-5"><h2 className="mb-2 text-sm font-semibold">Suggested questions</h2><div className="flex flex-wrap gap-2">{suggestedQuestions.map((item) => <button key={item} type="button" disabled={isLoading} onClick={() => setQuestion(item)} className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-left text-xs text-[var(--color-text)] hover:border-[var(--color-primary)] disabled:opacity-50">{item}</button>)}</div></div>
      {error ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm">{error}</p> : null}
      {isLoading ? <p role="status" className="mb-4 flex items-center gap-2 text-sm text-[var(--color-muted)]"><LoaderCircle className="h-4 w-4 animate-spin" />Querying the allowed academy aggregates and validating the response...</p> : null}
      {answer ? <div className="space-y-5">
        <Card className="border-l-4 border-l-[var(--color-primary)] p-5"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Answer</h2><span className="text-xs text-[var(--color-muted)]">Groq · {model}</span></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--color-text)]">{answer.answer}</p></Card>
        {answer.keyMetrics.length ? <Card className="p-5"><h2 className="mb-3 font-semibold">Verified metrics</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{answer.keyMetrics.map((metric, index) => <div key={`${metric.sourceField}-${index}`} className="rounded-xl border border-[var(--color-border)] p-3"><p className="text-xs text-[var(--color-muted)]">{metric.label}</p><p className="mt-1 break-words text-lg font-semibold text-[var(--color-text)]">{metric.value}</p><p className="mt-1 break-all text-[10px] text-[var(--color-muted)]">Source: {metric.sourceField}</p></div>)}</div></Card> : null}
        <div className="grid gap-5 lg:grid-cols-2"><Card className="p-5"><div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--color-green)]" /><h2 className="font-semibold">Supporting data</h2></div>{answer.supportingPoints.length ? <ul className="space-y-2">{answer.supportingPoints.map((item, index) => <li key={index} className="rounded-xl bg-[var(--color-background)] p-3 text-sm">{item}</li>)}</ul> : <p className="text-sm text-[var(--color-muted)]">No additional points were returned.</p>}</Card><Card className="p-5"><div className="mb-3 flex items-center gap-2"><Lightbulb className="h-4 w-4 text-[var(--color-primary)]" /><h2 className="font-semibold">Recommended actions</h2></div>{answer.recommendedActions.length ? <ul className="space-y-2">{answer.recommendedActions.map((item, index) => <li key={index} className="flex gap-2 rounded-xl bg-[var(--color-background)] p-3 text-sm"><ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />{item}</li>)}</ul> : <p className="text-sm text-[var(--color-muted)]">No actions were recommended for this question.</p>}</Card></div>
      </div> : null}
    </div>
  );
}
