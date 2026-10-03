import api from './api';

export type AnalyticsPeriod = 'last_7_days' | 'last_30_days' | 'last_90_days';

export type CountBreakdown = {
  label: string;
  total: number;
};

export type DepartmentBreakdown = {
  id: number;
  department: string;
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
};

export type AttentionTicket = {
  ticketNumber: string;
  category: string | null;
  priority: string;
  department: string | null;
  studentName: string;
  status: string;
  createdAt: string;
};

export type AnalyticsOverview = {
  period: AnalyticsPeriod;
  periodDays: number;
  totalStudents: number;
  totalCourses: number;
  totalComplaints: number;
  openComplaints: number;
  highPriorityComplaints: number;
  resolvedComplaints: number;
  totalTickets: number;
  status: CountBreakdown[];
  priorities: CountBreakdown[];
  categories: CountBreakdown[];
  departments: DepartmentBreakdown[];
  sentiments: CountBreakdown[];
  trends: Array<{ date: string; total: number }>;
  resolution: {
    resolvedTickets: number;
    averageResolutionHours: number | null;
    activeStatuses: CountBreakdown[];
  };
  recurringIssues: CountBreakdown[];
  needsAttention: AttentionTicket[];
};

export type ManagementInsights = {
  summary: string;
  keyIssues: string[];
  riskAreas: string[];
  recommendations: string[];
  priorityAction: string;
};

export type StoredManagementInsight = ManagementInsights & {
  id: number;
  period: AnalyticsPeriod;
  provider: string;
  model: string;
  inputSnapshot: unknown;
  generatedAt: string;
};

export const analyticsService = {
  async getOverview(period: AnalyticsPeriod) {
    return api.get<{ success: true; analytics: AnalyticsOverview }>('/admin/analytics/overview', { params: { period } });
  },
  async getTrends(period: AnalyticsPeriod) {
    return api.get<{ success: true; period: AnalyticsPeriod; trends: AnalyticsOverview['trends'] }>('/admin/analytics/trends', { params: { period } });
  },
  async getDepartments(period: AnalyticsPeriod) {
    return api.get<{ success: true; period: AnalyticsPeriod; departments: DepartmentBreakdown[] }>('/admin/analytics/departments', { params: { period } });
  },
  async getSentiments(period: AnalyticsPeriod) {
    return api.get<{ success: true; period: AnalyticsPeriod; sentiments: CountBreakdown[] }>('/admin/analytics/sentiments', { params: { period } });
  },
  async getPriorities(period: AnalyticsPeriod) {
    return api.get<{ success: true; period: AnalyticsPeriod; priorities: CountBreakdown[] }>('/admin/analytics/priorities', { params: { period } });
  },
  async getInsightHistory() {
    return api.get<{ success: true; insights: StoredManagementInsight[] }>('/admin/ai-insights');
  },
  async getInsight(id: number) {
    return api.get<{ success: true; insight: StoredManagementInsight }>(`/admin/ai-insights/${id}`);
  },
  async generateInsights(period: AnalyticsPeriod) {
    return api.post<{ success: true; insight: StoredManagementInsight }>('/admin/ai-insights/generate', { period }, { timeout: 40000 });
  },
};