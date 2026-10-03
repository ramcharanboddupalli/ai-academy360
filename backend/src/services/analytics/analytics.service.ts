import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../../config/database.js';

export const ANALYTICS_PERIODS = {
  last_7_days: 7,
  last_30_days: 30,
  last_90_days: 90,
} as const;

export type AnalyticsPeriod = keyof typeof ANALYTICS_PERIODS;

export function getPeriodStartDate(period: AnalyticsPeriod): Date {
  return new Date(Date.now() - ANALYTICS_PERIODS[period] * 24 * 60 * 60 * 1000);
}

function numericRows(rows: RowDataPacket[], key = 'total') {
  return rows.map((row) => ({ ...row, [key]: Number(row[key]) }));
}

async function getOverviewCounts(period: AnalyticsPeriod, since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM students) AS totalStudents,
       (SELECT COUNT(*) FROM courses) AS totalCourses,
       (SELECT COUNT(*) FROM tickets) AS totalComplaints,
       (SELECT COUNT(*) FROM tickets WHERE status = 'open') AS openComplaints,
       (SELECT COUNT(*) FROM tickets WHERE priority IN ('high', 'urgent') AND status NOT IN ('resolved', 'closed')) AS highPriorityComplaints,
       (SELECT COUNT(*) FROM tickets WHERE status IN ('resolved', 'closed')) AS resolvedComplaints,
       (SELECT COUNT(*) FROM tickets WHERE created_at >= ?) AS periodTicketCount`,
    [since],
  );
  const row = rows[0];
  return {
    period,
    periodDays: ANALYTICS_PERIODS[period],
    totalStudents: Number(row.totalStudents),
    totalCourses: Number(row.totalCourses),
    totalComplaints: Number(row.totalComplaints),
    openComplaints: Number(row.openComplaints),
    highPriorityComplaints: Number(row.highPriorityComplaints),
    resolvedComplaints: Number(row.resolvedComplaints),
    totalTickets: Number(row.periodTicketCount),
  };
}

export async function getTicketStatusBreakdown(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    'SELECT status AS label, COUNT(*) AS total FROM tickets WHERE created_at >= ? GROUP BY status ORDER BY status',
    [since],
  );
  return numericRows(rows);
}

export async function getPriorityBreakdown(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    'SELECT priority AS label, COUNT(*) AS total FROM tickets WHERE created_at >= ? GROUP BY priority ORDER BY FIELD(priority, \'urgent\', \'high\', \'medium\', \'low\')',
    [since],
  );
  return numericRows(rows);
}

export async function getCategoryBreakdown(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT category AS label, COUNT(*) AS total FROM tickets
     WHERE created_at >= ? AND category IS NOT NULL AND category <> ''
     GROUP BY category ORDER BY total DESC, category`,
    [since],
  );
  return numericRows(rows);
}

export async function getDepartmentBreakdown(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT d.id, d.name AS department, COUNT(t.id) AS total,
            COALESCE(SUM(t.status = 'open'), 0) AS open,
            COALESCE(SUM(t.status = 'in_progress'), 0) AS inProgress,
            COALESCE(SUM(t.status IN ('resolved', 'closed')), 0) AS resolved
     FROM departments d
     LEFT JOIN tickets t ON t.department_id = d.id AND t.created_at >= ?
     GROUP BY d.id, d.name ORDER BY total DESC, d.name`,
    [since],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    department: String(row.department),
    total: Number(row.total),
    open: Number(row.open),
    inProgress: Number(row.inProgress),
    resolved: Number(row.resolved),
  }));
}

export async function getSentimentBreakdown(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT a.sentiment AS label, COUNT(*) AS total
     FROM ai_analysis a INNER JOIN tickets t ON t.id = a.ticket_id
     WHERE t.created_at >= ? AND a.sentiment IS NOT NULL AND a.sentiment <> ''
     GROUP BY a.sentiment ORDER BY total DESC, a.sentiment`,
    [since],
  );
  return numericRows(rows);
}

export async function getTicketTrends(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS total
     FROM tickets WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY DATE(created_at)`,
    [since],
  );
  return rows.map((row) => ({
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10),
    total: Number(row.total),
  }));
}

export async function getResolutionMetrics(since: Date) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS resolvedTickets,
            AVG(TIMESTAMPDIFF(MINUTE, t.created_at, h.resolvedAt)) / 60 AS averageResolutionHours
     FROM tickets t
     INNER JOIN (
       SELECT ticket_id, MIN(created_at) AS resolvedAt FROM ticket_status_history
       WHERE new_status IN ('resolved', 'closed') GROUP BY ticket_id
     ) h ON h.ticket_id = t.id
     WHERE t.created_at >= ? AND t.status IN ('resolved', 'closed')`,
    [since],
  );
  const [statusRows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT status AS label, COUNT(*) AS total FROM tickets WHERE created_at >= ?
     AND status IN ('open', 'in_progress') GROUP BY status ORDER BY status`,
    [since],
  );
  const metrics = rows[0];
  return {
    resolvedTickets: Number(metrics.resolvedTickets),
    averageResolutionHours: metrics.averageResolutionHours === null ? null : Number(metrics.averageResolutionHours),
    activeStatuses: numericRows(statusRows),
  };
}

export async function getRecurringIssues(since: Date) {
  return getCategoryBreakdown(since);
}

export async function getNeedsAttention(since: Date, limit = 10) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT CONCAT('TKT-', LPAD(t.id, 6, '0')) AS ticketNumber,
            t.category, t.priority, d.name AS department, s.full_name AS studentName,
            t.status, DATE_FORMAT(t.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
     FROM tickets t
     INNER JOIN students s ON s.id = t.student_id
     LEFT JOIN departments d ON d.id = t.department_id
     WHERE t.created_at >= ? AND t.priority IN ('high', 'urgent') AND t.status NOT IN ('resolved', 'closed')
     ORDER BY FIELD(t.priority, 'urgent', 'high'), t.created_at DESC LIMIT ?`,
    [since, limit],
  );
  return rows;
}

export async function getAnalyticsOverview(period: AnalyticsPeriod) {
  const since = getPeriodStartDate(period);
  const [overview, status, priority, categories, departments, sentiments, trends, resolution, attention] = await Promise.all([
    getOverviewCounts(period, since),
    getTicketStatusBreakdown(since),
    getPriorityBreakdown(since),
    getCategoryBreakdown(since),
    getDepartmentBreakdown(since),
    getSentimentBreakdown(since),
    getTicketTrends(since),
    getResolutionMetrics(since),
    getNeedsAttention(since),
  ]);

  return {
    ...overview,
    status,
    priorities: priority,
    categories,
    departments,
    sentiments,
    trends,
    resolution,
    recurringIssues: categories,
    needsAttention: attention,
  };
}

export function createManagementInsightSnapshot(analytics: Awaited<ReturnType<typeof getAnalyticsOverview>>) {
  return {
    period: `last_${analytics.periodDays}_days`,
    periodDays: analytics.periodDays,
    totalTickets: analytics.totalTickets,
    openTickets: Number(analytics.status.find((row) => row.label === 'open')?.total ?? 0),
    inProgressTickets: Number(analytics.status.find((row) => row.label === 'in_progress')?.total ?? 0),
    resolvedTickets: Number(analytics.status.find((row) => row.label === 'resolved')?.total ?? 0)
      + Number(analytics.status.find((row) => row.label === 'closed')?.total ?? 0),
    highPriorityTickets: analytics.priorities
      .filter((row) => row.label === 'high' || row.label === 'urgent')
      .reduce((sum, row) => sum + Number(row.total), 0),
    categories: analytics.categories.map(({ label, total }) => ({ category: label, count: Number(total) })),
    departments: analytics.departments.map(({ department, total, open, inProgress, resolved }) => ({ department, total, open, inProgress, resolved })),
    sentiments: analytics.sentiments.map(({ label, total }) => ({ sentiment: label, count: Number(total) })),
  };
}

export type ManagementInsightRecord = {
  id: number;
  period: AnalyticsPeriod;
  provider: string;
  model: string;
  inputSnapshot: unknown;
  summary: string;
  keyIssues: string[];
  riskAreas: string[];
  recommendations: string[];
  priorityAction: string;
  generatedAt: string;
};

function parseJsonValue<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

function insightFromRow(row: RowDataPacket): ManagementInsightRecord {
  return {
    id: Number(row.id),
    period: row.period,
    provider: row.provider,
    model: row.model,
    inputSnapshot: parseJsonValue(row.inputSnapshot),
    summary: row.summary,
    keyIssues: parseJsonValue(row.keyIssues),
    riskAreas: parseJsonValue(row.riskAreas),
    recommendations: parseJsonValue(row.recommendations),
    priorityAction: row.priorityAction,
    generatedAt: row.generatedAt,
  };
}

export async function saveManagementInsight(
  generatedBy: number,
  period: AnalyticsPeriod,
  model: string,
  inputSnapshot: unknown,
  insights: import('../ai/ai.schema.js').AIManagementInsightsResult,
) {
  const [result] = await getDatabasePool().execute(
    `INSERT INTO ai_management_insights
      (generated_by, period, provider, model, input_snapshot, summary, key_issues, risk_areas, recommendations, priority_action)
     VALUES (?, ?, 'Groq', ?, ?, ?, ?, ?, ?, ?)`,
    [generatedBy, period, model, JSON.stringify(inputSnapshot), insights.summary,
      JSON.stringify(insights.keyIssues), JSON.stringify(insights.riskAreas),
      JSON.stringify(insights.recommendations), insights.priorityAction],
  );
  return getManagementInsight(Number((result as { insertId: number | string }).insertId));
}

export async function getManagementInsight(id: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT id, period, provider, model, input_snapshot AS inputSnapshot, summary,
            key_issues AS keyIssues, risk_areas AS riskAreas, recommendations,
            priority_action AS priorityAction,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS generatedAt
     FROM ai_management_insights WHERE id = ? LIMIT 1`,
    [id],
  );
  return rows[0] ? insightFromRow(rows[0]) : null;
}

export async function getManagementInsightHistory(limit = 20) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT id, period, provider, model, input_snapshot AS inputSnapshot, summary,
            key_issues AS keyIssues, risk_areas AS riskAreas, recommendations,
            priority_action AS priorityAction,
            DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS generatedAt
     FROM ai_management_insights ORDER BY created_at DESC, id DESC LIMIT ?`,
    [limit],
  );
  return rows.map(insightFromRow);
}