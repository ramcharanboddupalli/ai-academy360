import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../../config/database.js';
import { createNotification, notifyAdmins } from '../notification.service.js';
import type { AIAnalysisResult } from '../ai/ai.schema.js';

type DatabaseExecutor = Pool | PoolConnection;

export const TICKET_STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'] as const;
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export class StudentAccountUnavailableError extends Error {}
export class TicketNotFoundError extends Error {}
export class TicketDepartmentMissingError extends Error {}
export class TicketAdminNotFoundError extends Error {}

export type AdminTicketFilters = {
  status?: string;
  priority?: string;
  category?: string;
  department?: string;
  search?: string;
};

function toTicketNumber(id: number | string): string {
  return `TKT-${String(id).padStart(6, '0')}`;
}

function parseTicketNumber(ticketNumber: string): number | null {
  const match = /^TKT-(\d{1,20})$/i.exec(ticketNumber);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const ticketProjection = `
  SELECT t.id, t.title, t.description, t.category, t.priority, t.status, t.source,
         d.name AS department, t.assigned_to AS assignedAdminId, a.full_name AS assignedAdminName,
         DATE_FORMAT(t.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
         DATE_FORMAT(t.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt,
         s.full_name AS studentName, s.student_id AS studentId, s.email AS studentEmail
  FROM tickets t
  INNER JOIN students s ON s.id = t.student_id
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN admins a ON a.id = t.assigned_to`;

function publicTicket(row: RowDataPacket): RowDataPacket & { ticketNumber: string; studentId: string } {
  const ticketRow = row as RowDataPacket & { id: number | string; studentId: string };
  const { id, ...ticket } = ticketRow;
  return { ticketNumber: toTicketNumber(id), ...ticket };
}

async function getTicketById(executor: DatabaseExecutor, id: number) {
  const [rows] = await executor.execute<RowDataPacket[]>(`${ticketProjection} WHERE t.id = ? LIMIT 1`, [id]);
  if (!rows[0]) return null;

  const [messages] = await executor.execute<RowDataPacket[]>(
    `SELECT m.message, m.created_at AS createdAt, u.role AS senderRole,
            COALESCE(ad.full_name, st.full_name, 'Academy team') AS senderName
     FROM ticket_messages m
     INNER JOIN users u ON u.id = m.sender_id
     LEFT JOIN admins ad ON ad.user_id = u.id
     LEFT JOIN students st ON st.user_id = u.id
     WHERE m.ticket_id = ? ORDER BY m.created_at, m.id`,
    [id],
  );
  const [analyses] = await executor.execute<RowDataPacket[]>(
    `SELECT intent, category, priority, department, sentiment, summary,
            suggested_response AS suggestedResponse, recommended_action AS recommendedAction,
            confidence, created_at AS createdAt
     FROM ai_analysis WHERE ticket_id = ? ORDER BY created_at DESC, id DESC LIMIT 1`,
    [id],
  );
  const [statusHistory] = await executor.execute<RowDataPacket[]>(
    `SELECT h.previous_status AS previousStatus, h.new_status AS newStatus,
            COALESCE(ad.full_name, 'Academy system') AS changedBy,
            DATE_FORMAT(h.created_at, '%Y-%m-%dT%H:%i:%sZ') AS changedAt
     FROM ticket_status_history h
     LEFT JOIN admins ad ON ad.user_id = h.changed_by
     WHERE h.ticket_id = ? ORDER BY h.created_at, h.id`,
    [id],
  );

  return {
    ...publicTicket(rows[0]),
    messages: messages.map((message) => ({ ...message, senderRole: String(message.senderRole).toUpperCase() })),
    analysis: analyses[0] ? { ...analyses[0], confidence: Number(analyses[0].confidence) } : null,
    statusHistory,
  };
}

export async function getDepartmentNames(): Promise<string[]> {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>('SELECT name FROM departments ORDER BY name');
  return rows.map((row) => String(row.name));
}

export async function createAnalyzedTicket(userId: number, message: string, result: AIAnalysisResult) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [students] = await connection.execute<RowDataPacket[]>(
      "SELECT id FROM students WHERE user_id = ? AND status = 'Active' LIMIT 1 FOR UPDATE",
      [userId],
    );
    if (!students[0]) throw new StudentAccountUnavailableError();

    const [departments] = await connection.execute<RowDataPacket[]>('SELECT id FROM departments WHERE name = ? LIMIT 1', [result.department]);
    if (!departments[0]) throw new TicketDepartmentMissingError();

    const title = result.summary.trim().slice(0, 255);
    const [ticketResult] = await connection.execute(
      `INSERT INTO tickets (student_id, title, description, category, priority, status, department_id, source)
       VALUES (?, ?, ?, ?, ?, 'open', ?, 'student_ai_support')`,
      [students[0].id, title, message, result.category, result.priority.toLowerCase(), departments[0].id],
    );
    const ticketId = Number((ticketResult as { insertId: number | string }).insertId);
    await connection.execute('INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)', [ticketId, userId, message]);
    await connection.execute(
      `INSERT INTO ai_analysis (ticket_id, intent, category, priority, department, sentiment, summary,
                               suggested_response, recommended_action, confidence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ticketId, result.intent, result.category, result.priority, result.department, result.sentiment, result.summary,
        result.suggestedResponse, result.recommendedAction, result.confidence],
    );
    await connection.execute(
      "INSERT INTO ticket_status_history (ticket_id, previous_status, new_status, changed_by) VALUES (?, NULL, 'open', ?)",
      [ticketId, userId],
    );
    await notifyAdmins(connection, {
      title: result.priority === 'URGENT' || result.priority === 'HIGH' ? 'High-priority complaint' : 'New complaint',
      message: `${result.category.replaceAll('_', ' ')} support request: ${title}`,
      type: 'COMPLAINT',
      referenceType: 'ticket',
      referenceId: ticketId,
      dedupeKey: `ticket:${ticketId}:created`,
    });

    const ticket = await getTicketById(connection, ticketId);
    await connection.commit();
    transactionStarted = false;
    return ticket;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getStudentTickets(userId: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `${ticketProjection} WHERE s.user_id = ? ORDER BY t.updated_at DESC, t.id DESC`,
    [userId],
  );
  return rows.map(publicTicket);
}

export async function getStudentTicket(userId: number, ticketNumber: string) {
  const id = parseTicketNumber(ticketNumber);
  if (!id) return null;
  const ticket = await getTicketById(getDatabasePool(), id);
  if (!ticket || ticket.studentId === undefined) return null;
  const [owners] = await getDatabasePool().execute<RowDataPacket[]>(
    'SELECT id FROM students WHERE user_id = ? AND student_id = ? LIMIT 1',
    [userId, ticket.studentId],
  );
  return owners.length > 0 ? ticket : null;
}

export async function getAdminTickets(filters: AdminTicketFilters) {
  const conditions: string[] = [];
  const parameters: Array<string | number> = [];
  if (filters.status && (TICKET_STATUSES as readonly string[]).includes(filters.status)) {
    conditions.push('t.status = ?');
    parameters.push(filters.status);
  }
  if (filters.priority && (TICKET_PRIORITIES as readonly string[]).includes(filters.priority)) {
    conditions.push('t.priority = ?');
    parameters.push(filters.priority);
  }
  if (filters.category) {
    conditions.push('t.category = ?');
    parameters.push(filters.category);
  }
  if (filters.department) {
    conditions.push('d.name = ?');
    parameters.push(filters.department);
  }
  if (filters.search) {
    conditions.push('(t.title LIKE ? OR t.description LIKE ? OR s.full_name LIKE ? OR s.student_id LIKE ? OR CONCAT(\'TKT-\', LPAD(t.id, 6, \'0\')) LIKE ?)');
    const search = `%${filters.search}%`;
    parameters.push(search, search, search, search, search);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `${ticketProjection} ${where} ORDER BY FIELD(t.priority, 'urgent', 'high', 'medium', 'low'), t.updated_at DESC, t.id DESC`,
    parameters,
  );
  const [categories] = await getDatabasePool().query<RowDataPacket[]>(
    "SELECT DISTINCT category FROM tickets WHERE category IS NOT NULL AND category <> '' ORDER BY category",
  );
  const [departments] = await getDatabasePool().query<RowDataPacket[]>('SELECT id, name FROM departments ORDER BY name');
  return {
    tickets: rows.map(publicTicket),
    filters: {
      categories: categories.map((row) => row.category),
      departments,
      statuses: TICKET_STATUSES,
      priorities: TICKET_PRIORITIES,
    },
  };
}

export async function getAdminTicket(ticketNumber: string) {
  const id = parseTicketNumber(ticketNumber);
  return id ? getTicketById(getDatabasePool(), id) : null;
}

export async function updateTicketStatus(ticketNumber: string, status: (typeof TICKET_STATUSES)[number], adminUserId: number) {
  const id = parseTicketNumber(ticketNumber);
  if (!id) return null;
  const connection = await getDatabasePool().getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [rows] = await connection.execute<RowDataPacket[]>(
      'SELECT t.status, s.user_id AS studentUserId FROM tickets t INNER JOIN students s ON s.id = t.student_id WHERE t.id = ? FOR UPDATE',
      [id],
    );
    if (!rows[0]) {
      await connection.rollback();
      transactionStarted = false;
      return null;
    }
    if (rows[0].status !== status) {
      await connection.execute('UPDATE tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
      await connection.execute(
        'INSERT INTO ticket_status_history (ticket_id, previous_status, new_status, changed_by) VALUES (?, ?, ?, ?)',
        [id, rows[0].status, status, adminUserId],
      );
      await createNotification(connection, {
        userId: Number(rows[0].studentUserId),
        title: 'Support request updated',
        message: `${toTicketNumber(id)} status changed to ${status.replaceAll('_', ' ')}.`,
        type: 'COMPLAINT',
        referenceType: 'ticket',
        referenceId: id,
        dedupeKey: `ticket:${id}:status:${randomUUID()}`,
      });
    }
    const ticket = await getTicketById(connection, id);
    await connection.commit();
    transactionStarted = false;
    return ticket;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addAdminTicketMessage(ticketNumber: string, adminUserId: number, message: string) {
  const id = parseTicketNumber(ticketNumber);
  if (!id) return null;
  const connection = await getDatabasePool().getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [tickets] = await connection.execute<RowDataPacket[]>(
      `SELECT t.id, s.user_id AS userId FROM tickets t
       JOIN students s ON s.id = t.student_id WHERE t.id = ? FOR UPDATE`,
      [id],
    );
    if (!tickets[0]) {
      await connection.rollback();
      transactionStarted = false;
      return null;
    }
    await connection.execute('INSERT INTO ticket_messages (ticket_id, sender_id, message) VALUES (?, ?, ?)', [id, adminUserId, message]);
    await connection.execute('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    await createNotification(connection, {
      userId: Number(tickets[0].userId),
      title: 'New support response',
      message: `${toTicketNumber(id)} has a new administrator response.`,
      type: 'COMPLAINT',
      referenceType: 'ticket',
      referenceId: id,
      dedupeKey: `ticket:${id}:reply:${randomUUID()}`,
    });
    const ticket = await getTicketById(connection, id);
    await connection.commit();
    transactionStarted = false;
    return ticket;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function assignTicket(ticketNumber: string, adminId: number | null) {
  const id = parseTicketNumber(ticketNumber);
  if (!id) return null;
  const connection = await getDatabasePool().getConnection();
  let transactionStarted = false;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [tickets] = await connection.execute<RowDataPacket[]>('SELECT assigned_to AS assignedTo FROM tickets WHERE id = ? FOR UPDATE', [id]);
    if (!tickets[0]) {
      await connection.rollback();
      transactionStarted = false;
      return null;
    }
    if (adminId !== null) {
      const [admins] = await connection.execute<RowDataPacket[]>('SELECT id FROM admins WHERE id = ? LIMIT 1', [adminId]);
      if (!admins[0]) throw new TicketAdminNotFoundError();
    }
    if (Number(tickets[0].assignedTo) !== adminId) {
      await connection.execute('UPDATE tickets SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [adminId, id]);
      if (adminId !== null) await connection.execute('INSERT INTO ticket_assignments (ticket_id, assigned_to) VALUES (?, ?)', [id, adminId]);
    }
    const ticket = await getTicketById(connection, id);
    await connection.commit();
    transactionStarted = false;
    return ticket;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getAdminAssignees() {
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    `SELECT a.id, a.full_name AS name FROM admins a
     INNER JOIN users u ON u.id = a.user_id WHERE u.is_active = TRUE ORDER BY a.full_name`,
  );
  return rows;
}