import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mysql, { type RowDataPacket } from 'mysql2/promise';

dotenv.config();

const apiBase = `http://localhost:${process.env.PORT || '5000'}/api`;
const tests: Array<{ test: string; result: 'PASS' | 'FAIL'; [key: string]: unknown }> = [];
let temporaryStudentRecordId: number | string | undefined;
let adminToken: string | undefined;
let studentToken: string | undefined;

class TestStopError extends Error {
  constructor(readonly category: string) { super(category); }
}

function record(test: string, passed: boolean, details: Record<string, unknown> = {}) {
  tests.push({ test, result: passed ? 'PASS' : 'FAIL', ...details });
}

function sameCounts(a: any[], b: any[]) {
  return Array.isArray(a) && a.length === b.length
    && a.every((item, index) => item.label === b[index].label && Number(item.total) === Number(b[index].total));
}

function toDateOnly(value: unknown) {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

async function request(path: string, options: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, data: await response.json().catch(() => ({})) as Record<string, any> };
}

async function run() {
  let db: mysql.Connection | undefined;
  let currentStage = 'health_and_auth';
  try {
    const health = await request('/health');
    const dbHealth = await request('/health/db');
    record('API and MySQL health', health.status === 200 && dbHealth.status === 200 && dbHealth.data.database === 'connected', { apiStatus: health.status, databaseStatus: dbHealth.status });

    const managementLogin = await request('/auth/management/login', { method: 'POST', body: { email: process.env.VERIFY_ADMIN_EMAIL, password: process.env.VERIFY_ADMIN_PASSWORD } });
    adminToken = managementLogin.data.token;
    const adminUserId = Number(managementLogin.data.user?.id);
    record('Management authentication', managementLogin.status === 200 && Boolean(adminToken) && managementLogin.data.user?.role === 'ADMIN', { status: managementLogin.status, role: managementLogin.data.user?.role ?? null });
    if (!adminToken) throw new TestStopError('admin_login_failed');

    const noAuth = await request('/admin/analytics/overview');
    record('Unauthenticated analytics rejected', noAuth.status === 401, { status: noAuth.status });

    const courses = await request('/admin/courses', { token: adminToken });
    const courseId = courses.data.courses?.[0]?.id;
    if (!courseId) throw new TestStopError('active_course_unavailable');
    const temporaryPassword = crypto.randomBytes(24).toString('base64url');
    const created = await request('/admin/students', {
      method: 'POST',
      token: adminToken,
      body: {
        fullName: 'Analytics Access Verification Student',
        email: `analytics-verify-${crypto.randomUUID()}@example.invalid`,
        phone: '5550100777',
        courseId,
        batch: `ANALYTICS-${crypto.randomUUID().slice(0, 8)}`,
        joinDate: new Date().toISOString().slice(0, 10),
        password: temporaryPassword,
      },
    });
    temporaryStudentRecordId = created.data.student?.id;
    record('Temporary student created through real admin API', created.status === 201 && Boolean(temporaryStudentRecordId), { status: created.status });
    if (!created.data.student?.studentId) throw new TestStopError('temporary_student_creation_failed');
    const studentLogin = await request('/auth/student/login', { method: 'POST', body: { studentId: created.data.student.studentId, password: temporaryPassword } });
    studentToken = studentLogin.data.token;
    record('Temporary student authenticated', studentLogin.status === 200 && Boolean(studentToken), { status: studentLogin.status });
    if (!studentToken) throw new TestStopError('temporary_student_login_failed');

    const studentAccess = await request('/admin/analytics/overview', { token: studentToken });
    record('Student denied admin analytics', studentAccess.status === 403, { status: studentAccess.status });

    db = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
    let aggregateMatches = true;
    const periodCounts: Record<string, number> = {};
    currentStage = 'period_analytics_comparisons';
    const [[totals]] = await db.query<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM students) AS students,
              (SELECT COUNT(*) FROM courses) AS courses,
              (SELECT COUNT(*) FROM tickets) AS tickets,
              (SELECT COUNT(*) FROM tickets WHERE status='open') AS openTickets,
              (SELECT COUNT(*) FROM tickets WHERE priority IN ('high','urgent') AND status NOT IN ('resolved','closed')) AS highPriority,
              (SELECT COUNT(*) FROM tickets WHERE status IN ('resolved','closed')) AS resolvedTickets`,
    );
    for (const period of ['last_7_days', 'last_30_days', 'last_90_days'] as const) {
      const response = await request(`/admin/analytics/overview?period=${period}`, { token: adminToken });
      const days = Number(period.match(/\d+/)?.[0] ?? 7);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const [[ticketRows]] = await db.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM tickets WHERE created_at >= ?', [since]);
      const expectedTicketCount = Number(ticketRows.total);
      periodCounts[period] = response.data.analytics?.totalTickets;
      aggregateMatches &&= response.status === 200
        && response.data.analytics?.period === period
        && Number(response.data.analytics?.totalTickets) === expectedTicketCount;

      const analytics = response.data.analytics;
      const [[statusRows], [priorityRows], [categoryRows], [departmentRows], [sentimentRows], [trendRows], [resolutionRows], [attentionRows]] = await Promise.all([
        db.execute<RowDataPacket[]>('SELECT status AS label,COUNT(*) AS total FROM tickets WHERE created_at >= ? GROUP BY status ORDER BY status', [since]),
        db.execute<RowDataPacket[]>('SELECT priority AS label,COUNT(*) AS total FROM tickets WHERE created_at >= ? GROUP BY priority ORDER BY FIELD(priority, \'urgent\', \'high\', \'medium\', \'low\')', [since]),
        db.execute<RowDataPacket[]>('SELECT category AS label,COUNT(*) AS total FROM tickets WHERE created_at >= ? AND category IS NOT NULL AND category<>\'\' GROUP BY category ORDER BY total DESC,category', [since]),
        db.execute<RowDataPacket[]>(`SELECT d.id,d.name AS department,COUNT(t.id) AS total,COALESCE(SUM(t.status='open'),0) AS open,COALESCE(SUM(t.status='in_progress'),0) AS inProgress,COALESCE(SUM(t.status IN ('resolved','closed')),0) AS resolved FROM departments d LEFT JOIN tickets t ON t.department_id=d.id AND t.created_at >= ? GROUP BY d.id,d.name ORDER BY total DESC,d.name`, [since]),
        db.execute<RowDataPacket[]>(`SELECT a.sentiment AS label,COUNT(*) AS total FROM ai_analysis a JOIN tickets t ON t.id=a.ticket_id WHERE t.created_at >= ? AND a.sentiment IS NOT NULL AND a.sentiment<>'' GROUP BY a.sentiment ORDER BY total DESC,a.sentiment`, [since]),
        db.execute<RowDataPacket[]>('SELECT DATE(created_at) AS date,COUNT(*) AS total FROM tickets WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY DATE(created_at)', [since]),
        db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS resolvedTickets,AVG(TIMESTAMPDIFF(MINUTE,t.created_at,h.resolvedAt))/60 AS averageResolutionHours FROM tickets t INNER JOIN (SELECT ticket_id,MIN(created_at) AS resolvedAt FROM ticket_status_history WHERE new_status IN ('resolved','closed') GROUP BY ticket_id) h ON h.ticket_id=t.id WHERE t.created_at >= ? AND t.status IN ('resolved','closed')`, [since]),
        db.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM tickets WHERE created_at >= ? AND priority IN ('high','urgent') AND status NOT IN ('resolved','closed')`, [since]),
      ]);
      const trendsEndpoint = await request(`/admin/analytics/trends?period=${period}`, { token: adminToken });
      const attentionEndpoint = await request(`/admin/analytics/needs-attention?period=${period}`, { token: adminToken });
      const departmentMatch = analytics?.departments?.length === departmentRows.length && analytics.departments.every((item: any, index: number) => item.department === departmentRows[index].department && Number(item.total) === Number(departmentRows[index].total) && Number(item.open) === Number(departmentRows[index].open) && Number(item.inProgress) === Number(departmentRows[index].inProgress) && Number(item.resolved) === Number(departmentRows[index].resolved));
      const trendMatch = trendsEndpoint.status === 200 && trendsEndpoint.data.trends.length === trendRows.length && trendsEndpoint.data.trends.every((item: any, index: number) => toDateOnly(item.date) === toDateOnly(trendRows[index].date) && Number(item.total) === Number(trendRows[index].total));
      const resolutionMatch = analytics?.resolution?.resolvedTickets === Number(resolutionRows[0].resolvedTickets)
        && (resolutionRows[0].averageResolutionHours === null ? analytics.resolution.averageResolutionHours === null : Math.abs(Number(analytics.resolution.averageResolutionHours) - Number(resolutionRows[0].averageResolutionHours)) < 0.001);
      const overviewMatch = Number(analytics?.totalStudents) === Number(totals.students)
        && Number(analytics?.totalCourses) === Number(totals.courses)
        && Number(analytics?.totalComplaints) === Number(totals.tickets)
        && Number(analytics?.openComplaints) === Number(totals.openTickets)
        && Number(analytics?.highPriorityComplaints) === Number(totals.highPriority)
        && Number(analytics?.resolvedComplaints) === Number(totals.resolvedTickets);
      const attentionMatch = Array.isArray(analytics?.needsAttention)
        && Number(attentionRows[0].total) === analytics.needsAttention.length
        && attentionEndpoint.status === 200
        && attentionEndpoint.data.tickets.length === Number(attentionRows[0].total);
      const periodMatches = response.status === 200 && Number(analytics?.totalTickets) === expectedTicketCount
        && overviewMatch && sameCounts(analytics?.status, statusRows) && sameCounts(analytics?.priorities, priorityRows)
        && sameCounts(analytics?.categories, categoryRows) && sameCounts(analytics?.sentiments, sentimentRows)
        && departmentMatch && trendMatch && resolutionMatch && attentionMatch
        && JSON.stringify(analytics?.recurringIssues) === JSON.stringify(analytics?.categories);
      record(`${days}-day analytics match direct MySQL results`, periodMatches, {
        overview: overviewMatch,
        status: sameCounts(analytics?.status, statusRows),
        priority: sameCounts(analytics?.priorities, priorityRows),
        category: sameCounts(analytics?.categories, categoryRows),
        department: departmentMatch,
        sentiment: sameCounts(analytics?.sentiments, sentimentRows),
        trend: trendMatch,
        resolution: Boolean(resolutionMatch),
        attention: attentionMatch,
      });
    }
    record('Period filtering matches MySQL timestamps for 7/30/90 days', aggregateMatches, { periodCounts });

    const overview = await request('/admin/analytics/overview?period=last_90_days', { token: adminToken });
    const analytics = overview.data.analytics;
    record('Overview metrics match direct MySQL counts', overview.status === 200
      && Number(analytics.totalStudents) === Number(totals.students)
      && Number(analytics.totalCourses) === Number(totals.courses)
      && Number(analytics.totalComplaints) === Number(totals.tickets)
      && Number(analytics.openComplaints) === Number(totals.openTickets)
      && Number(analytics.highPriorityComplaints) === Number(totals.highPriority)
      && Number(analytics.resolvedComplaints) === Number(totals.resolvedTickets), { status: overview.status });

    currentStage = 'direct_breakdown_queries';
    const [priorities] = await db.query<RowDataPacket[]>('SELECT priority AS label,COUNT(*) AS total FROM tickets WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) GROUP BY priority ORDER BY FIELD(priority, \'urgent\', \'high\', \'medium\', \'low\')');
    const [sentiments] = await db.query<RowDataPacket[]>(`SELECT a.sentiment AS label,COUNT(*) AS total FROM ai_analysis a JOIN tickets t ON t.id=a.ticket_id WHERE t.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) AND a.sentiment IS NOT NULL GROUP BY a.sentiment ORDER BY total DESC,a.sentiment`);
    const [categories] = await db.query<RowDataPacket[]>(`SELECT category AS label,COUNT(*) AS total FROM tickets WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) AND category IS NOT NULL AND category<>'' GROUP BY category ORDER BY total DESC,category`);
    const [departmentRows] = await db.query<RowDataPacket[]>(`SELECT d.id,d.name AS department,COUNT(t.id) AS total,COALESCE(SUM(t.status='open'),0) AS open,COALESCE(SUM(t.status='in_progress'),0) AS inProgress,COALESCE(SUM(t.status IN ('resolved','closed')),0) AS resolved FROM departments d LEFT JOIN tickets t ON t.department_id=d.id AND t.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) GROUP BY d.id,d.name ORDER BY total DESC,d.name`);
    currentStage = 'analytics_comparisons';
    const [trendRows] = await db.query<RowDataPacket[]>(`SELECT DATE(created_at) AS date,COUNT(*) AS total FROM tickets WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) GROUP BY DATE(created_at) ORDER BY DATE(created_at)`);
    const [resolutionRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS resolvedTickets,AVG(TIMESTAMPDIFF(MINUTE,t.created_at,h.resolvedAt))/60 AS averageResolutionHours FROM tickets t INNER JOIN (SELECT ticket_id,MIN(created_at) AS resolvedAt FROM ticket_status_history WHERE new_status IN ('resolved','closed') GROUP BY ticket_id) h ON h.ticket_id=t.id WHERE t.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) AND t.status IN ('resolved','closed')`);
    const [attentionRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM tickets WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 90 DAY) AND priority IN ('high','urgent') AND status NOT IN ('resolved','closed')`);
    currentStage = 'priority_category_sentiment_comparison';
    record('Priority/category/sentiment distributions match MySQL', sameCounts(analytics.priorities, priorities) && sameCounts(analytics.categories, categories) && sameCounts(analytics.sentiments, sentiments), {
      priorityRows: analytics.priorities.length,
      categoryRows: analytics.categories.length,
      sentimentRows: analytics.sentiments.length,
    });
    currentStage = 'department_endpoint_comparison';
    const departmentMatch = analytics.departments.length === departmentRows.length && analytics.departments.every((item: any, index: number) => item.department === departmentRows[index].department && Number(item.total) === Number(departmentRows[index].total) && Number(item.open) === Number(departmentRows[index].open) && Number(item.inProgress) === Number(departmentRows[index].inProgress) && Number(item.resolved) === Number(departmentRows[index].resolved));
    const departmentsEndpoint = await request('/admin/analytics/departments?period=last_90_days', { token: adminToken });
    record('Department workload matches direct MySQL grouping', departmentMatch && departmentsEndpoint.status === 200, { endpointStatus: departmentsEndpoint.status, departmentCount: analytics.departments.length });
    currentStage = 'trend_endpoint_comparison';
    const trendsEndpoint = await request('/admin/analytics/trends?period=last_90_days', { token: adminToken });
    const trendMatch = trendsEndpoint.status === 200 && trendsEndpoint.data.trends.length === trendRows.length && trendsEndpoint.data.trends.every((item: any, index: number) => toDateOnly(item.date) === toDateOnly(trendRows[index].date) && Number(item.total) === Number(trendRows[index].total));
    record('Ticket trends match real grouped creation dates', trendMatch, {
      endpointStatus: trendsEndpoint.status,
      pointCount: trendRows.length,
      apiFirstPoint: trendsEndpoint.data.trends?.[0] ? { date: trendsEndpoint.data.trends[0].date, total: trendsEndpoint.data.trends[0].total } : null,
      mysqlFirstPoint: trendRows[0] ? { date: toDateOnly(trendRows[0].date), total: Number(trendRows[0].total) } : null,
    });
    currentStage = 'specialized_breakdown_endpoints';
    const priorityEndpoint = await request('/admin/analytics/priorities?period=last_90_days', { token: adminToken });
    const sentimentEndpoint = await request('/admin/analytics/sentiments?period=last_90_days', { token: adminToken });
    const categoryEndpoint = await request('/admin/analytics/categories?period=last_90_days', { token: adminToken });
    const statusEndpoint = await request('/admin/analytics/statuses?period=last_90_days', { token: adminToken });
    record('Dedicated status/category/priority/sentiment endpoints', priorityEndpoint.status === 200 && sentimentEndpoint.status === 200 && categoryEndpoint.status === 200 && statusEndpoint.status === 200, { status: statusEndpoint.status, category: categoryEndpoint.status, priority: priorityEndpoint.status, sentiment: sentimentEndpoint.status });
    currentStage = 'resolution_history_comparison';
    const resolutionMatches = analytics.resolution.resolvedTickets === Number(resolutionRows[0].resolvedTickets)
      && (resolutionRows[0].averageResolutionHours === null ? analytics.resolution.averageResolutionHours === null : Math.abs(Number(analytics.resolution.averageResolutionHours) - Number(resolutionRows[0].averageResolutionHours)) < 0.001);
    record('Resolution performance matches ticket status history', resolutionMatches, { resolvedTickets: analytics.resolution.resolvedTickets, averageAvailable: analytics.resolution.averageResolutionHours !== null });
    currentStage = 'needs_attention_comparison';
    record('Recurring issues follow real category ordering', JSON.stringify(analytics.recurringIssues) === JSON.stringify(analytics.categories), { categoryCount: analytics.recurringIssues.length });
    const attentionEndpoint = await request('/admin/analytics/needs-attention?period=last_90_days', { token: adminToken });
    record('Needs Attention matches high/urgent unresolved MySQL filter', Array.isArray(analytics.needsAttention) && analytics.needsAttention.every((item: any) => ['high', 'urgent'].includes(item.priority) && !['resolved', 'closed'].includes(item.status)) && Number(attentionRows[0].total) === analytics.needsAttention.length && attentionEndpoint.status === 200, { endpointStatus: attentionEndpoint.status, tickets: analytics.needsAttention.length, mysqlCount: Number(attentionRows[0].total) });

    currentStage = 'groq_generation';
    const generated = await request('/admin/ai-insights/generate', { method: 'POST', token: adminToken, body: { period: 'last_90_days' } });
    const insight = generated.data.insight;
    const insightValid = Boolean(insight && insight.provider === 'Groq' && insight.model === process.env.AI_MODEL
      && typeof insight.summary === 'string' && insight.summary.length > 0
      && Array.isArray(insight.keyIssues) && insight.keyIssues.length > 0
      && Array.isArray(insight.riskAreas) && Array.isArray(insight.recommendations) && insight.recommendations.length > 0
      && typeof insight.priorityAction === 'string' && insight.priorityAction.length > 0);
    record('Groq management insights are structured and validated', generated.status === 201 && insightValid, { status: generated.status, provider: insight?.provider ?? null, model: insight?.model ?? null, diagnostic: generated.data.diagnostic ?? null });
    const snapshotString = JSON.stringify(insight?.inputSnapshot ?? {});
    const snapshotHasPII = /studentName|studentId|studentEmail|password/i.test(snapshotString);
    record('Groq input contains aggregate data without student PII', Boolean(insight) && !snapshotHasPII, { piiKeysPresent: snapshotHasPII });
    const historyResponse = await request('/admin/ai-insights', { token: adminToken });
    record('Generated insight stored and appears in history', historyResponse.status === 200 && historyResponse.data.insights?.some((item: any) => item.id === insight?.id), { status: historyResponse.status, stored: Boolean(historyResponse.data.insights?.some((item: any) => item.id === insight?.id)) });
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
    record('Analytics verification completed', false, {
      category: error instanceof TestStopError ? error.category : 'runtime_error',
      stage: currentStage,
      ...(error instanceof Error ? { errorName: error.name } : {}),
      ...(errorCode ? { errorCode } : {}),
    });
  } finally {
    if (studentToken) await request('/auth/logout', { method: 'POST', token: studentToken }).catch(() => undefined);
    if (adminToken && temporaryStudentRecordId) {
      await request(`/admin/students/${encodeURIComponent(temporaryStudentRecordId)}/status`, { method: 'PATCH', token: adminToken, body: { status: 'Inactive' } }).catch(() => undefined);
    }
    if (adminToken) await request('/auth/logout', { method: 'POST', token: adminToken }).catch(() => undefined);
    if (db) await db.end().catch(() => undefined);
  }

  const failures = tests.filter((test) => test.result !== 'PASS');
  console.log(JSON.stringify({ provider: 'Groq', model: process.env.AI_MODEL, tests, allPassed: failures.length === 0, failures: failures.length, temporaryStudentDeactivated: Boolean(temporaryStudentRecordId), secretsPrinted: false }, null, 2));
  if (failures.length) process.exitCode = 1;
}

run().catch(() => {
  console.log(JSON.stringify({ fatal: true, secretsPrinted: false }));
  process.exitCode = 1;
});