import axios from 'axios';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquareText } from 'lucide-react';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { MetricCard } from '../../components/MetricCard';
import { Modal } from '../../components/Modal';
import { PageHeader } from '../../components/PageHeader';
import { SearchInput } from '../../components/SearchInput';
import { StatusBadge } from '../../components/StatusBadge';
import { ticketService, type Ticket, type TicketFilterOptions, type TicketStatus } from '../../services/ticket.service';

const emptyFilters: TicketFilterOptions = { categories: [], departments: [], statuses: ['open', 'in_progress', 'pending', 'resolved', 'closed'], priorities: ['low', 'medium', 'high', 'urgent'] };

function titleCase(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function badgeTone(value: string): 'success' | 'warning' | 'info' {
  if (value === 'resolved' || value === 'closed') return 'success';
  if (value === 'open' || value === 'urgent' || value === 'high') return 'warning';
  return 'info';
}

function apiError(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response?.status === 401) return 'Your management session has expired. Sign in again.';
    if (error.response?.status === 403) return 'You are not authorized to manage support requests.';
    if (error.response?.data.message) return error.response.data.message;
  }
  return fallback;
}

export function AdminComplaintsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [filterOptions, setFilterOptions] = useState<TicketFilterOptions>(emptyFilters);
  const [assignees, setAssignees] = useState<Array<{ id: number | string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [statusSelection, setStatusSelection] = useState<TicketStatus>('open');
  const [assigneeSelection, setAssigneeSelection] = useState('');
  const [reply, setReply] = useState('');
  const [detailError, setDetailError] = useState('');
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [isSendingReply, setIsSendingReply] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    ticketService.getAdminTickets({ search, status: statusFilter, priority: priorityFilter, category: categoryFilter, department: departmentFilter })
      .then((response) => {
        if (!isMounted) return;
        setTickets(response.data.tickets);
        setFilterOptions(response.data.filters);
        setPageError('');
      })
      .catch((error: unknown) => { if (isMounted) setPageError(apiError(error, 'Support requests could not be loaded.')); })
      .finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [search, statusFilter, priorityFilter, categoryFilter, departmentFilter]);

  useEffect(() => {
    ticketService.getAssignees().then((response) => setAssignees(response.data.assignees)).catch(() => setAssignees([]));
  }, []);

  const updateListRecord = (updatedTicket: Ticket) => {
    setTickets((current) => current.map((ticket) => ticket.ticketNumber === updatedTicket.ticketNumber ? updatedTicket : ticket));
    setSelectedTicket(updatedTicket);
  };

  const openTicket = async (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setStatusSelection(ticket.status as TicketStatus);
    setAssigneeSelection(ticket.assignedAdminId == null ? '' : String(ticket.assignedAdminId));
    setReply('');
    setDetailError('');
    setIsDetailLoading(true);
    try {
      const response = await ticketService.getAdminTicket(ticket.ticketNumber);
      setSelectedTicket(response.data.ticket);
      setStatusSelection(response.data.ticket.status as TicketStatus);
      setAssigneeSelection(response.data.ticket.assignedAdminId == null ? '' : String(response.data.ticket.assignedAdminId));
    } catch (error) {
      setDetailError(apiError(error, 'Ticket details could not be loaded.'));
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    const ticketNumber = searchParams.get('ticket');
    if (!ticketNumber || isLoading || selectedTicket) return;
    const ticket = tickets.find((item) => item.ticketNumber === ticketNumber);
    if (ticket) void openTicket(ticket);
    else if (!isLoading) setPageError('The linked support request was not found in the current ticket queue.');
  }, [searchParams, tickets, isLoading, selectedTicket]);

  const closeTicket = () => {
    setSelectedTicket(null);
    if (searchParams.has('ticket')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('ticket');
      setSearchParams(nextParams, { replace: true });
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedTicket) return;
    setIsUpdatingStatus(true);
    setDetailError('');
    try {
      const response = await ticketService.updateStatus(selectedTicket.ticketNumber, statusSelection);
      updateListRecord(response.data.ticket);
    } catch (error) {
      setDetailError(apiError(error, 'Ticket status could not be updated.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignment = async () => {
    if (!selectedTicket) return;
    setIsUpdatingAssignment(true);
    setDetailError('');
    try {
      const response = await ticketService.assign(selectedTicket.ticketNumber, assigneeSelection || null);
      updateListRecord(response.data.ticket);
    } catch (error) {
      setDetailError(apiError(error, 'Ticket assignment could not be updated.'));
    } finally {
      setIsUpdatingAssignment(false);
    }
  };

  const handleReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTicket || !reply.trim()) return;
    setIsSendingReply(true);
    setDetailError('');
    try {
      const response = await ticketService.reply(selectedTicket.ticketNumber, reply.trim());
      updateListRecord(response.data.ticket);
      setReply('');
    } catch (error) {
      setDetailError(apiError(error, 'Your response could not be sent.'));
    } finally {
      setIsSendingReply(false);
    }
  };

  const openCount = tickets.filter((ticket) => ticket.status === 'open').length;
  const inProgressCount = tickets.filter((ticket) => ticket.status === 'in_progress' || ticket.status === 'pending').length;
  const resolvedCount = tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Complaints" subtitle="Review student support requests and coordinate resolutions." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Open" value={String(openCount).padStart(2, '0')} note="Unresolved" icon={<MessageSquareText className="h-4 w-4" />} />
        <MetricCard label="In progress" value={String(inProgressCount).padStart(2, '0')} note="Being reviewed" icon={<MessageSquareText className="h-4 w-4" />} />
        <MetricCard label="Resolved" value={String(resolvedCount).padStart(2, '0')} note="Completed" icon={<MessageSquareText className="h-4 w-4" />} />
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SearchInput value={search} onChange={setSearch} placeholder="Search tickets" />
        <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]"><option value="">All statuses</option>{filterOptions.statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>
        <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]"><option value="">All priorities</option>{filterOptions.priorities.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>
        <select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]"><option value="">All categories</option>{filterOptions.categories.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select>
        <select aria-label="Filter by department" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2.5 text-sm text-[var(--color-text)]"><option value="">All departments</option>{filterOptions.departments.map((value) => <option key={value.id} value={value.name}>{titleCase(value.name)}</option>)}</select>
      </div>

      {pageError ? <p role="alert" className="mb-4 rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)]">{pageError}</p> : null}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[var(--color-background)] p-2 text-[var(--color-primary)]"><MessageSquareText className="h-4 w-4" /></div>
          <h3 className="font-semibold text-[var(--color-text)]">Case queue</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]"><th className="pb-3 pr-4 font-medium">Ticket</th><th className="pb-3 pr-4 font-medium">Student</th><th className="pb-3 pr-4 font-medium">Issue</th><th className="pb-3 pr-4 font-medium">Category</th><th className="pb-3 pr-4 font-medium">Priority</th><th className="pb-3 pr-4 font-medium">Department</th><th className="pb-3 pr-4 font-medium">Status</th><th className="pb-3 font-medium">Updated</th></tr></thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.ticketNumber} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="whitespace-nowrap py-3 pr-4 font-semibold text-[var(--color-text)]">{ticket.ticketNumber}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-text)]">{ticket.studentName}<span className="block text-xs text-[var(--color-muted)]">{ticket.studentId}</span></td>
                  <td className="min-w-48 py-3 pr-4 text-[var(--color-text)]">{ticket.title}</td>
                  <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-muted)]">{titleCase(ticket.category)}</td>
                  <td className="py-3 pr-4"><StatusBadge label={titleCase(ticket.priority)} tone={badgeTone(ticket.priority)} /></td>
                  <td className="whitespace-nowrap py-3 pr-4 text-[var(--color-muted)]">{ticket.department ? titleCase(ticket.department) : 'Unassigned'}</td>
                  <td className="py-3 pr-4"><StatusBadge label={titleCase(ticket.status)} tone={badgeTone(ticket.status)} /></td>
                  <td className="whitespace-nowrap py-3"><Button variant="ghost" size="sm" onClick={() => void openTicket(ticket)}>Open</Button></td>
                </tr>
              ))}
              {isLoading ? <tr><td colSpan={8} className="py-8 text-center text-[var(--color-muted)]">Loading support requests...</td></tr> : null}
              {!isLoading && tickets.length === 0 ? <tr><td colSpan={8} className="py-8 text-center text-[var(--color-muted)]">No support requests match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={selectedTicket !== null} title={selectedTicket ? `Ticket #${selectedTicket.ticketNumber}` : undefined} onClose={closeTicket}>
        {selectedTicket ? (
          <div className="space-y-5">
            {detailError ? <p role="alert" className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{detailError}</p> : null}
            {isDetailLoading ? <p className="text-sm text-[var(--color-muted)]">Loading ticket details...</p> : null}
            <section className="space-y-2">
              <h4 className="font-semibold text-[var(--color-text)]">{selectedTicket.title}</h4>
              <p className="text-sm text-[var(--color-muted)]">{selectedTicket.studentName} · {selectedTicket.studentId} · {selectedTicket.studentEmail}</p>
              <p className="whitespace-pre-wrap rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3 text-sm text-[var(--color-text)]">{selectedTicket.description}</p>
              <div className="flex flex-wrap gap-2"><StatusBadge label={titleCase(selectedTicket.category)} /><StatusBadge label={titleCase(selectedTicket.priority)} tone={badgeTone(selectedTicket.priority)} /><StatusBadge label={titleCase(selectedTicket.status)} tone={badgeTone(selectedTicket.status)} /></div>
            </section>

            {selectedTicket.analysis ? (
              <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
                <h4 className="font-semibold text-[var(--color-text)]">AI Analysis</h4>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-[var(--color-muted)]">Intent</span><br />{titleCase(selectedTicket.analysis.intent)}</p>
                  <p><span className="text-[var(--color-muted)]">Sentiment</span><br />{titleCase(selectedTicket.analysis.sentiment)}</p>
                  <p><span className="text-[var(--color-muted)]">Department</span><br />{titleCase(selectedTicket.analysis.department)}</p>
                  <p><span className="text-[var(--color-muted)]">Confidence</span><br />{Math.round(Number(selectedTicket.analysis.confidence) * 100)}%</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3"><p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Summary</p><p className="mt-2 text-sm text-[var(--color-text)]">{selectedTicket.analysis.summary}</p></div>
                <div className="rounded-xl border border-[var(--color-border)] p-3"><p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Recommended Action</p><p className="mt-2 text-sm text-[var(--color-text)]">{selectedTicket.analysis.recommendedAction}</p></div>
                <div className="rounded-xl border border-[var(--color-border)] p-3"><p className="text-xs font-semibold uppercase text-[var(--color-muted)]">Suggested Response · Admin review required</p><p className="mt-2 text-sm text-[var(--color-text)]">{selectedTicket.analysis.suggestedResponse}</p></div>
              </section>
            ) : null}

            <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
              <h4 className="font-semibold text-[var(--color-text)]">Conversation</h4>
              {(selectedTicket.messages ?? []).map((item, index) => (
                <div key={`${item.createdAt}-${index}`} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                  <div className="flex justify-between gap-3 text-xs text-[var(--color-muted)]"><span>{item.senderName}</span><span>{new Date(item.createdAt).toLocaleString()}</span></div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text)]">{item.message}</p>
                </div>
              ))}
            </section>

            <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
              <h4 className="font-semibold text-[var(--color-text)]">Status history</h4>
              {(selectedTicket.statusHistory ?? []).length ? selectedTicket.statusHistory!.map((item, index) => (
                <div key={`${item.changedAt}-${index}`} className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{item.previousStatus ? `${titleCase(item.previousStatus)} → ` : ''}{titleCase(item.newStatus)} · {item.changedBy}</span>
                  <span className="text-[var(--color-muted)]">{new Date(item.changedAt).toLocaleString()}</span>
                </div>
              )) : <p className="text-sm text-[var(--color-muted)]">No status changes are recorded.</p>}
            </section>

            <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
              <h4 className="font-semibold text-[var(--color-text)]">Manage request</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-[var(--color-muted)]">Status<select value={statusSelection} onChange={(event) => setStatusSelection(event.target.value as TicketStatus)} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[var(--color-text)]">{filterOptions.statuses.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
                <div className="flex items-end"><Button variant="outline" loading={isUpdatingStatus} onClick={() => void handleStatusUpdate()}>Update status</Button></div>
                <label className="text-sm text-[var(--color-muted)]">Assignee<select value={assigneeSelection} onChange={(event) => setAssigneeSelection(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-[var(--color-text)]"><option value="">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.name}</option>)}</select></label>
                <div className="flex items-end"><Button variant="outline" loading={isUpdatingAssignment} onClick={() => void handleAssignment()}>Save assignment</Button></div>
              </div>
            </section>

            <form onSubmit={handleReply} className="space-y-3 border-t border-[var(--color-border)] pt-4">
              <label className="block text-sm font-medium text-[var(--color-text)]">Reply to student<textarea value={reply} onChange={(event) => setReply(event.target.value)} maxLength={5000} rows={3} required className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" /></label>
              <div className="flex justify-end"><Button type="submit" variant="primary" loading={isSendingReply}>Send response</Button></div>
            </form>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
