import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { MessageSquareWarning } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MetricCard } from '../../components/MetricCard';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { StatusBadge } from '../../components/StatusBadge';
import { ticketService, type Ticket, type TicketStatus } from '../../services/ticket.service';

const statuses: Array<TicketStatus | ''> = ['', 'open', 'in_progress', 'pending', 'resolved', 'closed'];

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusTone(status: string): 'success' | 'warning' | 'info' {
  if (status === 'resolved' || status === 'closed') return 'success';
  if (status === 'open' || status === 'urgent' || status === 'high') return 'warning';
  return 'info';
}

export function StudentComplaintsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TicketStatus | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    ticketService.getTickets()
      .then((response) => { if (isMounted) setTickets(response.data.tickets); })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setErrorMessage(axios.isAxiosError<{ message?: string }>(error) && error.response?.status === 401
          ? 'Your session has expired. Sign in again to view your requests.'
          : 'Support requests could not be loaded. Check your connection and try again.');
      })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, []);

  const visibleTickets = useMemo(() => tickets.filter((ticket) => {
    const matchesSearch = !search || [ticket.ticketNumber, ticket.title, ticket.category, ticket.department ?? '']
      .some((value) => value.toLowerCase().includes(search.toLowerCase()));
    return matchesSearch && (!status || ticket.status === status);
  }), [tickets, search, status]);

  const counts = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    inProgress: tickets.filter((ticket) => ticket.status === 'in_progress' || ticket.status === 'pending').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
  }), [tickets]);

  const viewTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    try {
      const response = await ticketService.getStudentTicket(ticket.ticketNumber);
      setSelectedTicket(response.data.ticket);
    } catch {
      setSelectedTicket(null);
      setErrorMessage('This support request could not be opened.');
    }
  };

  return (
    <>
    <div className="p-4 md:p-6">
      <PageHeader title="My Complaints" subtitle="Track concerns and support resolutions." />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Total Complaints" value={String(counts.total).padStart(2, '0')} note="Your support requests" icon={<MessageSquareWarning className="h-4 w-4" />} />
        <MetricCard label="Open" value={String(counts.open).padStart(2, '0')} note="Needs attention" icon={<MessageSquareWarning className="h-4 w-4" />} />
        <MetricCard label="In Progress" value={String(counts.inProgress).padStart(2, '0')} note="Being reviewed" icon={<MessageSquareWarning className="h-4 w-4" />} />
        <MetricCard label="Resolved" value={String(counts.resolved).padStart(2, '0')} note="Completed requests" icon={<MessageSquareWarning className="h-4 w-4" />} />
      </div>

      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search complaints" /></div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as TicketStatus | '')} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[var(--color-text)]">
            {statuses.map((value) => <option key={value || 'all'} value={value}>{value ? titleCase(value) : 'All statuses'}</option>)}
          </select>
        </label>
      </div>

      {errorMessage ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{errorMessage}</p> : null}

      <Card className="p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th className="pb-3 pr-4 font-medium">Ticket ID</th>
                <th className="pb-3 pr-4 font-medium">Issue</th>
                <th className="pb-3 pr-4 font-medium">Category</th>
                <th className="pb-3 pr-4 font-medium">Priority</th>
                <th className="pb-3 pr-4 font-medium">Department</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {visibleTickets.map((ticket) => (
                <tr key={ticket.ticketNumber} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="whitespace-nowrap py-3 pr-4 font-semibold text-[var(--color-text)]">{ticket.ticketNumber}</td>
                  <td className="py-3 pr-4 text-[var(--color-text)]">{ticket.title}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{ticket.category}</td>
                  <td className="py-3 pr-4"><StatusBadge label={titleCase(ticket.priority)} tone={statusTone(ticket.priority)} /></td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{ticket.department}</td>
                  <td className="py-3 pr-4"><StatusBadge label={titleCase(ticket.status)} tone={statusTone(ticket.status)} /></td>
                  <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-muted)]">{new Date(ticket.createdAt).toLocaleDateString()}</td>
                  <td className="py-3"><Button variant="ghost" size="sm" aria-label={`View ticket ${ticket.ticketNumber}`} onClick={() => void viewTicket(ticket)}>View</Button></td>
                </tr>
              ))}
              {isLoading ? <tr><td colSpan={8} className="py-8 text-center text-[var(--color-muted)]">Loading your support requests...</td></tr> : null}
              {!isLoading && visibleTickets.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-[var(--color-muted)]">{tickets.length ? 'No support requests match your filters.' : 'You have no support requests yet.'}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
    <Modal isOpen={selectedTicket !== null} title={selectedTicket ? `Ticket #${selectedTicket.ticketNumber}` : undefined} onClose={() => setSelectedTicket(null)}>
      {selectedTicket ? (
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-[var(--color-text)]">{selectedTicket.title}</h4>
            <p className="mt-2 text-sm text-[var(--color-muted)]">{titleCase(selectedTicket.category)} · {titleCase(selectedTicket.priority)} · {titleCase(selectedTicket.status)}</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">Department: {selectedTicket.department || 'Pending assignment'}</p>
          </div>
          <div className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h4 className="font-semibold text-[var(--color-text)]">Conversation</h4>
            {(selectedTicket.messages ?? []).map((item, index) => (
              <div key={`${item.createdAt}-${index}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                <div className="flex justify-between gap-3 text-xs text-[var(--color-muted)]"><span>{item.senderName}</span><span>{new Date(item.createdAt).toLocaleString()}</span></div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text)]">{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
    </>
  );
}
