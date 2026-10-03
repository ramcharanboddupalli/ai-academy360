import api from './api';

export type TicketStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TicketMessage = {
  message: string;
  createdAt: string;
  senderRole: 'ADMIN' | 'STUDENT';
  senderName: string;
};

export type TicketAnalysis = {
  intent: string;
  category: string;
  priority: string;
  department: string;
  sentiment: string;
  summary: string;
  suggestedResponse: string;
  recommendedAction: string;
  confidence: number;
  model?: string;
};

export type TicketStatusHistory = {
  previousStatus: string | null;
  newStatus: string;
  changedBy: string;
  changedAt: string;
};

export type Ticket = {
  ticketNumber: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  department: string | null;
  source?: string;
  studentName?: string;
  studentId?: string;
  studentEmail?: string;
  assignedAdminId?: number | string | null;
  assignedAdminName?: string | null;
  messages?: TicketMessage[];
  analysis?: TicketAnalysis | null;
  statusHistory?: TicketStatusHistory[];
  createdAt: string;
  updatedAt: string;
};

export type TicketFilters = {
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  department?: string;
};

export type TicketFilterOptions = {
  categories: string[];
  departments: Array<{ id: number | string; name: string }>;
  statuses: TicketStatus[];
  priorities: TicketPriority[];
};

export type TicketAnalysisResponse = TicketAnalysis & { model: string };

export const ticketService = {
  async getTickets() {
    return api.get<{ success: true; tickets: Ticket[] }>('/student/tickets');
  },
  async getStudentTicket(ticketNumber: string) {
    return api.get<{ success: true; ticket: Ticket }>(`/student/tickets/${encodeURIComponent(ticketNumber)}`);
  },
  async analyzeAndSubmit(message: string) {
    return api.post<{ success: true; message: string; ticket: Ticket; analysis: TicketAnalysisResponse }>(
      '/student/ai-support/analyze-and-submit',
      { message },
      { timeout: 35000 },
    );
  },
  async getAdminTickets(filters: TicketFilters = {}) {
    return api.get<{ success: true; tickets: Ticket[]; filters: TicketFilterOptions }>('/admin/tickets', { params: filters });
  },
  async getAdminTicket(ticketNumber: string) {
    return api.get<{ success: true; ticket: Ticket }>(`/admin/tickets/${encodeURIComponent(ticketNumber)}`);
  },
  async updateStatus(ticketNumber: string, status: TicketStatus) {
    return api.patch<{ success: true; ticket: Ticket }>(`/admin/tickets/${encodeURIComponent(ticketNumber)}/status`, { status });
  },
  async reply(ticketNumber: string, message: string) {
    return api.post<{ success: true; ticket: Ticket }>(`/admin/tickets/${encodeURIComponent(ticketNumber)}/messages`, { message });
  },
  async assign(ticketNumber: string, adminId: number | string | null) {
    return api.patch<{ success: true; ticket: Ticket }>(`/admin/tickets/${encodeURIComponent(ticketNumber)}/assignment`, { adminId });
  },
  async getAssignees() {
    return api.get<{ success: true; assignees: Array<{ id: number | string; name: string }> }>('/admin/ticket-assignees');
  },
};
