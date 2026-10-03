import axios from 'axios';
import { useState, type FormEvent } from 'react';
import { Sparkles, TicketCheck } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { PageHeader } from '../../components/PageHeader';
import { StatusBadge } from '../../components/StatusBadge';
import { ticketService, type TicketAnalysisResponse, type Ticket } from '../../services/ticket.service';

export function StudentSupportPage() {
  const [message, setMessage] = useState('');
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [analysis, setAnalysis] = useState<TicketAnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10 || trimmedMessage.length > 5000) {
      setErrorMessage('Describe your issue in 10 to 5000 characters.');
      return;
    }

    setErrorMessage('');
    setTicket(null);
    setAnalysis(null);
    setIsSubmitting(true);
    try {
      const response = await ticketService.analyzeAndSubmit(trimmedMessage);
      setTicket(response.data.ticket);
      setAnalysis(response.data.analysis);
    } catch (error) {
      if (axios.isAxiosError<{ message?: string }>(error)) {
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          setErrorMessage('AI analysis took too long. Your request was not submitted; please try again.');
        } else if (error.response?.status === 401) {
          setErrorMessage('Your session has expired. Sign in again to submit a support request.');
        } else if (error.response?.status === 403) {
          setErrorMessage('An active student account is required to submit a support request.');
        } else if (error.response?.status === 422) {
          setErrorMessage(error.response.data.message || 'Check your message and try again.');
        } else if (error.response?.status === 503) {
          setErrorMessage('AI support is temporarily unavailable. Your request was not submitted.');
        } else if (error.response?.status === 502) {
          setErrorMessage('AI could not validate an analysis. Your request was not submitted; please try again.');
        } else if (!error.response) {
          setErrorMessage('Cannot reach the support service. Check your connection and try again.');
        } else {
          setErrorMessage(error.response.data.message || 'Your support request could not be submitted.');
        }
      } else {
        setErrorMessage('Your support request could not be submitted.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const titleCase = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="AI Support" subtitle="Describe your issue and our AI assistant will analyze it and create a support request." />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><Sparkles className="h-4 w-4" /></div>
            <h3 className="font-semibold text-[var(--color-text)]">Describe your issue</h3>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block">
              <span className="sr-only">Describe your issue</span>
              <textarea
                rows={8}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                minLength={10}
                maxLength={5000}
                required
                disabled={isSubmitting}
                placeholder="I paid for the Data Analytics course yesterday, but my enrollment is still not showing."
                className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm text-[var(--color-text)] outline-none placeholder:text-[var(--color-muted)] focus:border-[var(--color-primary)] disabled:opacity-70"
              />
            </label>
            <div className="mt-2 flex justify-between text-xs text-[var(--color-muted)]">
              <span>Do not include passwords or payment card details.</span>
              <span>{message.length}/5000</span>
            </div>
            {errorMessage ? <p role="alert" className="mt-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}
            {isSubmitting ? <p role="status" className="mt-4 text-sm text-[var(--color-muted)]">AI is analyzing your request...</p> : null}
            <div className="mt-5">
              <Button type="submit" variant="primary" loading={isSubmitting}>
                <Sparkles className="h-4 w-4" /> Analyze &amp; Submit
              </Button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[var(--color-text)]">Request result</h3>
            {analysis ? <StatusBadge label="Analyzed" tone="success" /> : null}
          </div>

          {!ticket || !analysis ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 text-sm text-[var(--color-muted)]">
              <p>Verified AI analysis and ticket details will appear here after your request is processed.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div role="status" className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <TicketCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-green)]" />
                <div>
                  <p className="font-semibold text-[var(--color-text)]">Your support request has been submitted.</p>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">Ticket #{ticket.ticketNumber}</p>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--color-text)]">{ticket.title}</span>
                  <StatusBadge label={titleCase(ticket.status)} tone={ticket.status === 'resolved' || ticket.status === 'closed' ? 'success' : ticket.priority === 'urgent' || ticket.priority === 'high' ? 'warning' : 'info'} />
                </div>
                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div><span className="text-[var(--color-muted)]">Category</span><p className="text-[var(--color-text)]">{titleCase(ticket.category)}</p></div>
                  <div><span className="text-[var(--color-muted)]">Priority</span><p className="text-[var(--color-text)]">{titleCase(ticket.priority)}</p></div>
                  <div><span className="text-[var(--color-muted)]">Department</span><p className="text-[var(--color-text)]">{titleCase(ticket.department || analysis.department)}</p></div>
                  <div><span className="text-[var(--color-muted)]">Status</span><p className="text-[var(--color-text)]">{titleCase(ticket.status)}</p></div>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                <p className="text-xs font-semibold uppercase text-[var(--color-muted)]">AI Summary</p>
                <p className="mt-2 text-sm text-[var(--color-text)]">{analysis.summary}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
