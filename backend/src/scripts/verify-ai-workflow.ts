import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mysql, { type RowDataPacket } from 'mysql2/promise';

dotenv.config();

const apiBase = `http://localhost:${process.env.PORT || '5000'}/api`;
const sampleMessage = 'I paid for the Data Analytics course yesterday, but my enrollment is still not showing.';
const tests: Array<{ test: string; result: 'PASS' | 'FAIL'; [key: string]: unknown }> = [];
const cleanupStudentIds: Array<string | number> = [];

class WorkflowStopError extends Error {
  constructor(readonly category: string) {
    super(category);
  }
}

function record(test: string, passed: boolean, details: Record<string, unknown> = {}) {
  tests.push({ test, result: passed ? 'PASS' : 'FAIL', ...details });
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

function safeErrorStatus(error: unknown) {
  if (error instanceof WorkflowStopError) return error.category;
  if (typeof error === 'object' && error !== null && 'status' in error) return Number(error.status) || 'provider_error';
  if (typeof error === 'object' && error !== null && 'code' in error) return String(error.code);
  return 'runtime_error';
}

async function createStudent(adminToken: string, courseId: number | string, label: string) {
  const unique = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('base64url');
  const response = await request('/admin/students', {
    method: 'POST',
    token: adminToken,
    body: {
      fullName: `AI Workflow ${label}`,
      email: `ai-workflow-${unique}@example.invalid`,
      phone: '5550100998',
      courseId,
      batch: `AI-${unique.slice(0, 8)}`,
      joinDate: new Date().toISOString().slice(0, 10),
      password,
    },
  });
  return { response, password };
}

async function run() {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const legacyGroqKey = process.env.AI_API_KEY?.trim();
  const apiKey = groqKey || (legacyGroqKey?.startsWith('gsk_') ? legacyGroqKey : '');
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !model || !process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
    record('Required local Groq/auth configuration', false, { groqKeyPresent: Boolean(apiKey), modelConfigured: Boolean(model), adminSeedConfigured: Boolean(process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD) });
  }

  let db: mysql.Connection | undefined;
  let adminToken: string | undefined;
  let studentToken: string | undefined;
  let otherStudentToken: string | undefined;
  let studentUserId: number | undefined;
  let ticketNumber: string | undefined;
  let actualAIResult: Record<string, unknown> | null = null;

  try {
    const health = await request('/health');
    record('GET /api/health', health.status === 200 && health.data.success === true, { status: health.status });
    const databaseHealth = await request('/health/db');
    record('GET /api/health/db', databaseHealth.status === 200 && databaseHealth.data.database === 'connected', { status: databaseHealth.status });

    const adminLogin = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD },
    });
    adminToken = adminLogin.data.token;
    const adminUserId = Number(adminLogin.data.user?.id);
    record('Management login returns ADMIN session', adminLogin.status === 200 && Boolean(adminToken) && adminLogin.data.user?.role === 'ADMIN', {
      status: adminLogin.status,
      role: adminLogin.data.user?.role ?? null,
      sessionReturned: Boolean(adminToken),
    });
    if (!adminToken) throw new WorkflowStopError('admin_login_failed');

    const courseResponse = await request('/admin/courses', { token: adminToken });
    const course = courseResponse.data.courses?.[0];
    record('Protected admin course API', courseResponse.status === 200 && Boolean(course), { status: courseResponse.status });
    if (!course) throw new WorkflowStopError('course_unavailable');

    const studentA = await createStudent(adminToken, course.id, 'Primary Test Student');
    const studentAData = studentA.response.data.student;
    if (studentAData?.id) cleanupStudentIds.push(studentAData.id);
    record('Temporary student A created via admin API', studentA.response.status === 201 && Boolean(studentAData?.studentId), {
      status: studentA.response.status,
      studentIdAssigned: Boolean(studentAData?.studentId),
    });
    if (!studentAData?.studentId) throw new WorkflowStopError('student_a_creation_failed');

    const studentB = await createStudent(adminToken, course.id, 'Isolation Test Student');
    const studentBData = studentB.response.data.student;
    if (studentBData?.id) cleanupStudentIds.push(studentBData.id);
    record('Temporary student B created via admin API', studentB.response.status === 201 && Boolean(studentBData?.studentId), {
      status: studentB.response.status,
      studentIdAssigned: Boolean(studentBData?.studentId),
    });
    if (!studentBData?.studentId) throw new WorkflowStopError('student_b_creation_failed');

    const studentLogin = await request('/auth/student/login', {
      method: 'POST',
      body: { studentId: studentAData.studentId, password: studentA.password },
    });
    studentToken = studentLogin.data.token;
    studentUserId = Number(studentLogin.data.user?.id);
    record('Student A login with generated Student ID', studentLogin.status === 200 && Boolean(studentToken) && studentLogin.data.user?.studentId === studentAData.studentId, {
      status: studentLogin.status,
      sessionReturned: Boolean(studentToken),
    });

    const otherLogin = await request('/auth/student/login', {
      method: 'POST',
      body: { studentId: studentBData.studentId, password: studentB.password },
    });
    otherStudentToken = otherLogin.data.token;
    record('Student B login', otherLogin.status === 200 && Boolean(otherStudentToken), { status: otherLogin.status });
    if (!studentToken || !otherStudentToken) throw new WorkflowStopError('student_login_failed');

    const noAuthStudent = await request('/student/tickets');
    const noAuthAdmin = await request('/admin/tickets');
    const adminToStudent = await request('/student/tickets', { token: adminToken });
    const studentToAdmin = await request('/admin/tickets', { token: studentToken });
    record('Unauthenticated ticket routes reject access', noAuthStudent.status === 401 && noAuthAdmin.status === 401, {
      studentStatus: noAuthStudent.status,
      adminStatus: noAuthAdmin.status,
    });
    record('Cross-role ticket routes reject access', adminToStudent.status === 403 && studentToAdmin.status === 403, {
      adminToStudent: adminToStudent.status,
      studentToAdmin: studentToAdmin.status,
    });

    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [ticketCountsBefore] = await db.query<RowDataPacket[]>(
      'SELECT (SELECT COUNT(*) FROM tickets) AS tickets,(SELECT COUNT(*) FROM ticket_messages) AS messages,(SELECT COUNT(*) FROM ai_analysis) AS analyses,(SELECT COUNT(*) FROM ticket_status_history) AS history',
    );
    const exactResponse = await request('/student/ai-support/analyze-and-submit', {
      method: 'POST',
      token: studentToken,
      body: { message: sampleMessage, studentId: studentBData.studentId },
    });
    const analysis = exactResponse.data.analysis;
    ticketNumber = exactResponse.data.ticket?.ticketNumber;
    const actualModel = typeof analysis?.model === 'string' ? analysis.model : '';
    if (exactResponse.status === 201 && analysis) {
      actualAIResult = {
        model: actualModel,
        intent: analysis.intent,
        category: analysis.category,
        priority: analysis.priority,
        department: analysis.department,
        sentiment: analysis.sentiment,
        summary: analysis.summary,
        suggestedResponse: analysis.suggestedResponse,
        recommendedAction: analysis.recommendedAction,
        confidence: analysis.confidence,
      };
    }
    const validatedFields = Boolean(
      analysis
      && ['student_support', 'course_help', 'payment_issue', 'complaint', 'general_query'].includes(analysis.intent)
      && ['academic', 'admissions', 'billing', 'technical', 'administrative', 'wellbeing', 'other'].includes(analysis.category)
      && ['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(analysis.priority)
      && ['POSITIVE', 'NEUTRAL', 'FRUSTRATED', 'NEGATIVE'].includes(analysis.sentiment)
      && typeof analysis.department === 'string'
      && typeof analysis.summary === 'string' && analysis.summary.length > 0
      && typeof analysis.suggestedResponse === 'string' && analysis.suggestedResponse.length > 0
      && typeof analysis.recommendedAction === 'string' && analysis.recommendedAction.length > 0
      && typeof analysis.confidence === 'number' && analysis.confidence >= 0 && analysis.confidence <= 1,
    );
    record('Real Groq request creates no fake fallback', exactResponse.status === 201 && exactResponse.data.success === true, {
      status: exactResponse.status,
      errorCategory: exactResponse.status === 201 ? null : exactResponse.data.message ?? 'provider_request_failed',
      providerDiagnostic: exactResponse.data.diagnostic ?? null,
    });
    record('openai/gpt-oss-120b is the returned Groq model', exactResponse.status === 201 && actualModel === 'openai/gpt-oss-120b', {
      modelReturnedByProvider: actualModel || null,
      configuredModel: model,
    });
    record('Structured AI output passes server Zod validation', exactResponse.status === 201 && validatedFields, { fieldsValid: validatedFields });
    record('Student response includes public ticket and analysis', exactResponse.status === 201 && Boolean(ticketNumber) && exactResponse.data.ticket.status === 'open' && Boolean(exactResponse.data.ticket.department), {
      ticketNumber: ticketNumber ?? null,
      status: exactResponse.data.ticket?.status ?? null,
    });
    const [ticketCountsAfter] = await db.query<RowDataPacket[]>(
      'SELECT (SELECT COUNT(*) FROM tickets) AS tickets,(SELECT COUNT(*) FROM ticket_messages) AS messages,(SELECT COUNT(*) FROM ai_analysis) AS analyses,(SELECT COUNT(*) FROM ticket_status_history) AS history',
    );
    const countKeys = ['tickets', 'messages', 'analyses', 'history'] as const;
    const ticketTableCountsMatchResponse = countKeys.every((key) => {
      const before = Number(ticketCountsBefore[0][key]);
      const after = Number(ticketCountsAfter[0][key]);
      return exactResponse.status === 201 ? after === before + 1 : after === before;
    });
    record('Ticket tables changed only when AI request succeeded', ticketTableCountsMatchResponse, {
      tickets: Number(ticketCountsAfter[0].tickets),
      messages: Number(ticketCountsAfter[0].messages),
      analyses: Number(ticketCountsAfter[0].analyses),
      history: Number(ticketCountsAfter[0].history),
    });
    if (exactResponse.status !== 201 || !ticketNumber || !analysis) {
      throw new WorkflowStopError(`ai_request_http_${exactResponse.status}`);
    }

    const ticketIdMatch = /^TKT-(\d+)$/.exec(ticketNumber);
    const ticketId = ticketIdMatch ? Number(ticketIdMatch[1]) : 0;
    const [ticketRows] = await db.execute<RowDataPacket[]>(
      `SELECT t.student_id AS studentRecordId,t.title,t.description,t.category,t.priority,t.status,t.source,
              d.name AS department,s.student_id AS studentId,s.user_id AS userId,t.updated_at AS updatedAt
       FROM tickets t JOIN students s ON s.id=t.student_id LEFT JOIN departments d ON d.id=t.department_id
       WHERE t.id=?`,
      [ticketId],
    );
    const dbTicket = ticketRows[0];
    const beforeUpdatedAt = dbTicket?.updatedAt;
    const [messages] = await db.execute<RowDataPacket[]>(
      'SELECT sender_id AS senderId,message FROM ticket_messages WHERE ticket_id=? ORDER BY id',
      [ticketId],
    );
    const [analyses] = await db.execute<RowDataPacket[]>(
      `SELECT intent,category,priority,department,sentiment,summary,suggested_response AS suggestedResponse,
              recommended_action AS recommendedAction,confidence FROM ai_analysis WHERE ticket_id=? ORDER BY id`,
      [ticketId],
    );
    const [histories] = await db.execute<RowDataPacket[]>(
      'SELECT previous_status AS previousStatus,new_status AS newStatus,changed_by AS changedBy FROM ticket_status_history WHERE ticket_id=? ORDER BY id',
      [ticketId],
    );
    const categoryAndStatusExist = Boolean(dbTicket?.category && dbTicket.priority && dbTicket.department && dbTicket.status);
    const ownerMatches = Boolean(dbTicket && Number(dbTicket.userId) === studentUserId && dbTicket.studentId === studentAData.studentId);
    const originalMessageStored = messages.some((row) => Number(row.senderId) === studentUserId && row.message === sampleMessage);
    const analysisStored = analyses.length === 1
      && ['intent', 'category', 'priority', 'department', 'sentiment', 'summary', 'suggestedResponse', 'recommendedAction', 'confidence']
        .every((key) => analyses[0][key] !== null && analyses[0][key] !== undefined)
      && Number(analyses[0].confidence) === analysis.confidence;
    const initialHistoryStored = histories.some((row) => row.previousStatus === null && row.newStatus === 'open' && Number(row.changedBy) === studentUserId);
    record('Real MySQL ticket belongs to JWT student', ownerMatches && dbTicket.description === sampleMessage && dbTicket.source === 'student_ai_support' && categoryAndStatusExist, {
      stored: Boolean(dbTicket),
      ownershipMatches: ownerMatches,
      controlledFieldsPresent: categoryAndStatusExist,
    });
    record('Original ticket message is stored and linked', originalMessageStored, { originalMessageStored });
    record('AI analysis is stored and linked', analysisStored, { analysisStored });
    record('Initial OPEN status history is stored', initialHistoryStored, { initialHistoryStored });

    const adminQueue = await request(`/admin/tickets?search=${encodeURIComponent(ticketNumber)}`, { token: adminToken });
    const queueContainsTicket = adminQueue.data.tickets?.some((ticket: any) => ticket.ticketNumber === ticketNumber);
    record('Admin ticket queue returns created ticket', adminQueue.status === 200 && queueContainsTicket, { status: adminQueue.status, visible: Boolean(queueContainsTicket) });
    const adminDetail = await request(`/admin/tickets/${encodeURIComponent(ticketNumber)}`, { token: adminToken });
    const detail = adminDetail.data.ticket;
    const adminDetailComplete = adminDetail.status === 200 && detail?.studentId === studentAData.studentId
      && detail.description === sampleMessage && Boolean(detail.analysis?.suggestedResponse)
      && Boolean(detail.analysis?.recommendedAction) && detail.messages?.some((item: any) => item.message === sampleMessage);
    record('Admin detail includes student, issue and AI analysis', adminDetailComplete, { status: adminDetail.status, complete: adminDetailComplete });

    const otherStudentDetail = await request(`/student/tickets/${encodeURIComponent(ticketNumber)}`, { token: otherStudentToken });
    record('Student B cannot access Student A ticket', otherStudentDetail.status === 404, { status: otherStudentDetail.status });
    const studentList = await request('/student/tickets', { token: studentToken });
    record('Student A list contains own ticket despite spoofed body ID', studentList.status === 200 && studentList.data.tickets?.some((ticket: any) => ticket.ticketNumber === ticketNumber), { status: studentList.status });
    const studentDetail = await request(`/student/tickets/${encodeURIComponent(ticketNumber)}`, { token: studentToken });
    record('Student detail contains original message and analysis', studentDetail.status === 200
      && studentDetail.data.ticket.messages?.some((item: any) => item.message === sampleMessage)
      && Boolean(studentDetail.data.ticket.analysis?.summary), { status: studentDetail.status });

    const statusUpdate = await request(`/admin/tickets/${encodeURIComponent(ticketNumber)}/status`, {
      method: 'PATCH', token: adminToken, body: { status: 'in_progress' },
    });
    const [updatedRows] = await db.execute<RowDataPacket[]>('SELECT status,updated_at AS updatedAt FROM tickets WHERE id=?', [ticketId]);
    const [statusHistory] = await db.execute<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM ticket_status_history WHERE ticket_id=? AND previous_status='open' AND new_status='in_progress' AND changed_by=?",
      [ticketId, adminUserId],
    );
    const updatedAtAppropriate = Boolean(beforeUpdatedAt && new Date(updatedRows[0].updatedAt).getTime() >= new Date(beforeUpdatedAt).getTime());
    record('Admin status update persists and writes history', statusUpdate.status === 200 && updatedRows[0].status === 'in_progress' && Number(statusHistory[0].total) === 1 && updatedAtAppropriate, {
      status: statusUpdate.status,
      statusStored: updatedRows[0].status,
      historyAdded: Number(statusHistory[0].total) === 1,
      updatedAtRefreshed: updatedAtAppropriate,
    });

    const replyText = 'Your payment and enrollment details are being verified by the academy team.';
    const reply = await request(`/admin/tickets/${encodeURIComponent(ticketNumber)}/messages`, {
      method: 'POST', token: adminToken, body: { message: replyText },
    });
    const [replyRows] = await db.execute<RowDataPacket[]>(
      'SELECT sender_id AS senderId,message FROM ticket_messages WHERE ticket_id=? AND message=?',
      [ticketId, replyText],
    );
    const adminReplyStored = replyRows.some((row) => Number(row.senderId) === adminUserId);
    record('Admin response stored with admin sender identity', reply.status === 200 && adminReplyStored, { status: reply.status, adminSenderStored: adminReplyStored });

    const studentAfterReply = await request(`/student/tickets/${encodeURIComponent(ticketNumber)}`, { token: studentToken });
    const studentSeesReply = studentAfterReply.data.ticket?.messages?.some((item: any) => item.message === replyText && item.senderRole === 'ADMIN');
    record('Student sees current status and admin response', studentAfterReply.status === 200 && studentAfterReply.data.ticket.status === 'in_progress' && studentSeesReply, {
      status: studentAfterReply.status,
      responseVisible: Boolean(studentSeesReply),
    });

    const studentCannotUpdate = await request(`/admin/tickets/${encodeURIComponent(ticketNumber)}/status`, {
      method: 'PATCH', token: studentToken, body: { status: 'resolved' },
    });
    record('Student cannot update ticket status', studentCannotUpdate.status === 403, { status: studentCannotUpdate.status });
  } catch (error) {
    record('End-to-end workflow completed', false, { errorCategory: safeErrorStatus(error) });
  } finally {
    if (studentToken) await request('/auth/logout', { method: 'POST', token: studentToken }).catch(() => undefined);
    if (otherStudentToken) await request('/auth/logout', { method: 'POST', token: otherStudentToken }).catch(() => undefined);
    if (adminToken) {
      for (const studentId of cleanupStudentIds) {
        await request(`/admin/students/${encodeURIComponent(studentId)}/status`, {
          method: 'PATCH', token: adminToken, body: { status: 'Inactive' },
        }).catch(() => undefined);
      }
      await request('/auth/logout', { method: 'POST', token: adminToken }).catch(() => undefined);
    }
    if (db) await db.end().catch(() => undefined);
  }

  const failed = tests.filter((test) => test.result !== 'PASS');
  console.log(JSON.stringify({ provider: 'Groq', modelConfigured: model ?? null, actualAIResult, tests, allPassed: failed.length === 0, failures: failed.length, temporaryStudentsDeactivated: cleanupStudentIds.length, secretsAndTokensPrinted: false }, null, 2));
  if (failed.length > 0) process.exitCode = 1;
}

run().catch(() => {
  console.log(JSON.stringify({ fatal: true, secretsAndTokensPrinted: false }));
  process.exitCode = 1;
});