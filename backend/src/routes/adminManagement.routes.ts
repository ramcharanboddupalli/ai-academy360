import { Router, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { DatabaseConfigurationError, getDatabasePool } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import {
  createNotification,
  notifyCourseStudents,
  notifyPublishedAnnouncement,
} from '../services/notification.service.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

const resourceTypes = ['note', 'pdf', 'video', 'link', 'assignment'] as const;
const paymentStatuses = ['pending', 'paid', 'failed', 'refunded'] as const;
const paymentMethods = ['upi', 'bank_transfer', 'cash', 'card', 'other'] as const;
const taskStatuses = ['pending', 'in_progress', 'completed'] as const;
const attendanceStatuses = ['present', 'absent', 'late', 'excused'] as const;
const announcementCategories = ['general', 'course', 'schedule', 'payment', 'internship', 'important'] as const;
const announcementTargets = ['all', 'course', 'student'] as const;
const certificateStatuses = ['pending', 'issued', 'revoked'] as const;
const classStatuses = ['scheduled', 'live', 'completed', 'cancelled'] as const;
const internshipApplicationStatuses = ['applied', 'under_review', 'shortlisted', 'in_progress', 'completed', 'rejected', 'selected', 'withdrawn'] as const;
const internshipApplicationUpdateSchema = z.object({
  status: z.enum(internshipApplicationStatuses),
  adminNote: z.string().trim().max(2000).nullable().optional(),
}).strict();

function failure(res: Response, error: unknown, message: string) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'Database is not configured.' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'A record with that unique identifier already exists.' });
  }
  return res.status(500).json({ success: false, message });
}

function id(value: unknown) {
  const result = Number(value);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
}

function optionalText(value: unknown, max: number) {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' && value.trim().length <= max ? value.trim() || null : undefined;
}

function validDateTime(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || Number.isNaN(new Date(value).getTime())) return undefined;
  return value.replace('T', ' ').slice(0, 19);
}

async function hasRecord(table: string, recordId: number) {
  const allowed = new Set(['courses', 'students', 'classes', 'learning_tasks', 'payments', 'certificates', 'internships', 'announcements', 'resources']);
  if (!allowed.has(table)) throw new Error('Unsupported table lookup.');
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(`SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`, [recordId]);
  return rows.length > 0;
}

async function getCourseList() {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT c.id, c.code, c.title, c.description, c.instructor, c.is_active AS isActive,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS enrollmentCount
     FROM courses c ORDER BY c.title`,
  );
  return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive), enrollmentCount: Number(row.enrollmentCount) }));
}

router.get('/students/:id/360', async (req: Request, res: Response) => {
  const studentId = id(req.params.id);
  if (!studentId) return res.status(400).json({ success: false, message: 'Student record ID is invalid.' });
  try {
    const pool = getDatabasePool();
    const [[studentRows], [courses], [progress], [attendance], [payments], [certificates], [internships], [tickets], [activity]] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        `SELECT s.id, s.student_id AS studentId, s.full_name AS fullName, s.email, s.phone, s.batch,
                s.course_id AS courseId, c.title AS course, s.status,
                DATE_FORMAT(s.join_date, '%Y-%m-%d') AS joinDate
         FROM students s JOIN courses c ON c.id = s.course_id WHERE s.id = ?`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT c.id, c.code, c.title AS name, e.status, e.batch,
                DATE_FORMAT(e.enrolled_at, '%Y-%m-%dT%H:%i:%sZ') AS enrollmentDate
         FROM enrollments e JOIN courses c ON c.id = e.course_id
         WHERE e.student_id = ? AND e.status <> 'dropped' ORDER BY c.title`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT c.title AS course, p.progress_percent AS progress, p.current_topic AS currentTopic,
                DATE_FORMAT(p.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
         FROM enrollments e JOIN courses c ON c.id = e.course_id
         LEFT JOIN course_progress p ON p.enrollment_id = e.id
         WHERE e.student_id = ? AND e.status <> 'dropped' ORDER BY c.title`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT c.title AS course, COUNT(a.id) AS recordedClasses,
                SUM(a.status IN ('present', 'late')) AS attendedClasses,
                ROUND(SUM(a.status IN ('present', 'late')) * 100 / NULLIF(COUNT(a.id), 0), 1) AS attendancePercent
         FROM attendance a JOIN classes cl ON cl.id = a.class_id JOIN courses c ON c.id = cl.course_id
         WHERE a.student_id = ? GROUP BY c.id, c.title ORDER BY c.title`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT p.id, p.amount, p.currency, p.status, p.payment_date AS paymentDate, p.reference_id AS referenceId,
                c.title AS course
         FROM payments p LEFT JOIN enrollments e ON e.id = p.enrollment_id
         LEFT JOIN courses c ON c.id = e.course_id
         WHERE p.student_id = ? ORDER BY p.payment_date DESC, p.id DESC`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT cert.id, cert.certificate_id AS certificateId, cert.status, cert.issued_at AS issueDate,
                cert.file_url AS fileUrl, c.title AS course
         FROM certificates cert JOIN courses c ON c.id = cert.course_id
         WHERE cert.student_id = ? ORDER BY cert.created_at DESC`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT i.title, i.organization, a.status, a.applied_at AS appliedAt
         FROM internship_applications a JOIN internships i ON i.id = a.internship_id
         WHERE a.student_id = ? ORDER BY a.updated_at DESC`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT CONCAT('TKT-', LPAD(t.id, 6, '0')) AS ticketNumber, t.title, t.status, t.priority,
                t.category, d.name AS department, t.created_at AS createdAt, t.updated_at AS updatedAt
         FROM tickets t LEFT JOIN departments d ON d.id = t.department_id
         WHERE t.student_id = ? ORDER BY t.updated_at DESC`, [studentId],
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT activity, occurredAt FROM (
           SELECT 'Student account created' AS activity, s.created_at AS occurredAt FROM students s WHERE s.id = ?
           UNION ALL
           SELECT CONCAT('Enrolled in ', c.title), e.enrolled_at FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = ?
           UNION ALL
           SELECT CONCAT('Payment ', p.status, ': ', p.currency, ' ', p.amount), COALESCE(p.payment_date, p.created_at) FROM payments p WHERE p.student_id = ?
           UNION ALL
           SELECT CONCAT('Support ticket ', t.status, ': ', t.title), t.updated_at FROM tickets t WHERE t.student_id = ?
           UNION ALL
           SELECT CONCAT('Attendance ', a.status, ': ', cl.title), a.marked_at FROM attendance a JOIN classes cl ON cl.id = a.class_id WHERE a.student_id = ?
           UNION ALL
           SELECT CONCAT('Certificate ', cert.status, ': ', cert.certificate_id), COALESCE(cert.issued_at, cert.created_at) FROM certificates cert WHERE cert.student_id = ?
           UNION ALL
           SELECT CONCAT('Internship application ', ia.status, ': ', i.title), ia.updated_at FROM internship_applications ia JOIN internships i ON i.id = ia.internship_id WHERE ia.student_id = ?
         ) records ORDER BY occurredAt DESC LIMIT 30`, [studentId, studentId, studentId, studentId, studentId, studentId, studentId],
      ),
    ]);
    if (!studentRows[0]) return res.status(404).json({ success: false, message: 'Student not found.' });
    return res.json({
      success: true,
      student: { ...studentRows[0], courses },
      courses,
      progress: progress.map((row) => ({ ...row, progress: row.progress === null ? null : Number(row.progress) })),
      attendance: attendance.map((row) => ({ ...row, recordedClasses: Number(row.recordedClasses), attendedClasses: Number(row.attendedClasses), attendancePercent: row.attendancePercent === null ? null : Number(row.attendancePercent) })),
      payments: payments.map((row) => ({ ...row, amount: Number(row.amount) })),
      certificates,
      internships,
      tickets,
      recentActivity: activity,
    });
  } catch (error) {
    return failure(res, error, 'Student overview could not be loaded.');
  }
});

router.get('/management/courses', async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, courses: await getCourseList() });
  } catch (error) {
    return failure(res, error, 'Courses could not be loaded.');
  }
});

router.get('/management/courses/:id/students', async (req: Request, res: Response) => {
  const courseId = id(req.params.id);
  if (!courseId) return res.status(400).json({ success: false, message: 'Course ID is invalid.' });
  try {
    const [students] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT s.id, s.student_id AS studentId, s.full_name AS fullName, s.email, s.status AS studentStatus,
              e.status AS enrollmentStatus, e.batch,
              DATE_FORMAT(e.enrolled_at, '%Y-%m-%d') AS enrollmentDate
       FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.course_id = ? AND e.status <> 'dropped' ORDER BY s.full_name`,
      [courseId],
    );
    return res.json({ success: true, students });
  } catch (error) {
    return failure(res, error, 'Course enrollments could not be loaded.');
  }
});

router.post('/management/courses/:id/students', async (req: Request, res: Response) => {
  const courseId = id(req.params.id);
  const studentId = id(req.body?.studentId);
  if (!courseId || !studentId) return res.status(422).json({ success: false, message: 'Choose a valid course and student.' });
  try {
    const [result] = await getDatabasePool().execute(
      `INSERT INTO enrollments (student_id, course_id, batch, status)
       SELECT s.id, c.id, s.batch, 'active' FROM students s JOIN courses c ON c.id = ?
       WHERE s.id = ? AND s.status = 'Active' AND c.is_active = TRUE
       ON DUPLICATE KEY UPDATE batch = VALUES(batch), status = 'active'`,
      [courseId, studentId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) return res.status(422).json({ success: false, message: 'Active student and course are required.' });
    return res.status(201).json({ success: true });
  } catch (error) {
    return failure(res, error, 'Student could not be assigned to the course.');
  }
});

router.delete('/management/courses/:courseId/students/:studentId', async (req: Request, res: Response) => {
  const courseId = id(req.params.courseId);
  const studentId = id(req.params.studentId);
  if (!courseId || !studentId) return res.status(400).json({ success: false, message: 'Course or student ID is invalid.' });
  try {
    const [result] = await getDatabasePool().execute(
      `UPDATE enrollments SET status = 'dropped' WHERE course_id = ? AND student_id = ? AND status <> 'dropped'`,
      [courseId, studentId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0) return res.status(404).json({ success: false, message: 'Active course enrollment was not found.' });
    return res.json({ success: true });
  } catch (error) {
    return failure(res, error, 'Student could not be removed from the course.');
  }
});

router.post('/management/courses', async (req: Request, res: Response) => {
  const code = text(req.body?.code, 50);
  const title = text(req.body?.title, 150);
  const description = optionalText(req.body?.description, 10000);
  const instructor = optionalText(req.body?.instructor, 200);
  if (!code || !title || description === undefined || instructor === undefined) return res.status(422).json({ success: false, message: 'Enter a course code, title, and valid optional details.' });
  try {
    const [result] = await getDatabasePool().execute('INSERT INTO courses (code, title, description, instructor) VALUES (?, ?, ?, ?)', [code, title, description, instructor]);
    const insertId = Number((result as { insertId: number | string }).insertId);
    return res.status(201).json({ success: true, courseId: insertId });
  } catch (error) {
    return failure(res, error, 'Course could not be created.');
  }
});

router.put('/management/courses/:id', async (req: Request, res: Response) => {
  const courseId = id(req.params.id);
  const code = text(req.body?.code, 50);
  const title = text(req.body?.title, 150);
  const description = optionalText(req.body?.description, 10000);
  const instructor = optionalText(req.body?.instructor, 200);
  if (!courseId || !code || !title || description === undefined || instructor === undefined) return res.status(422).json({ success: false, message: 'Enter a course code, title, and valid optional details.' });
  try {
    const [result] = await getDatabasePool().execute('UPDATE courses SET code = ?, title = ?, description = ?, instructor = ? WHERE id = ?', [code, title, description, instructor, courseId]);
    if ((result as { affectedRows: number }).affectedRows === 0 && !(await hasRecord('courses', courseId))) return res.status(404).json({ success: false, message: 'Course not found.' });
    return res.json({ success: true, courseId });
  } catch (error) {
    return failure(res, error, 'Course could not be updated.');
  }
});

router.patch('/management/courses/:id/status', async (req: Request, res: Response) => {
  const courseId = id(req.params.id);
  if (!courseId || typeof req.body?.isActive !== 'boolean') return res.status(422).json({ success: false, message: 'Choose a valid course status.' });
  try {
    const [result] = await getDatabasePool().execute('UPDATE courses SET is_active = ? WHERE id = ?', [req.body.isActive, courseId]);
    if ((result as { affectedRows: number }).affectedRows === 0 && !(await hasRecord('courses', courseId))) return res.status(404).json({ success: false, message: 'Course not found.' });
    return res.json({ success: true, courseId, isActive: req.body.isActive });
  } catch (error) {
    return failure(res, error, 'Course status could not be updated.');
  }
});

router.get('/management/learning', async (req: Request, res: Response) => {
  const courseId = req.query.courseId === undefined ? null : id(req.query.courseId);
  if (req.query.courseId !== undefined && !courseId) return res.status(400).json({ success: false, message: 'Course ID is invalid.' });
  try {
    const [resources] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT r.id, r.course_id AS courseId, c.title AS course, r.title, r.description,
              r.resource_type AS resourceType, r.resource_url AS resourceUrl, r.is_active AS isActive
       FROM resources r JOIN courses c ON c.id = r.course_id
       WHERE (? IS NULL OR r.course_id = ?) ORDER BY r.created_at DESC`, [courseId, courseId],
    );
    const [tasks] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT t.id, t.student_id AS studentId, s.full_name AS studentName, t.course_id AS courseId,
              c.title AS course, t.title, t.description, DATE_FORMAT(t.due_at, '%Y-%m-%dT%H:%i:%s') AS dueAt,
              t.status, DATE_FORMAT(t.completed_at, '%Y-%m-%dT%H:%i:%s') AS completedAt
       FROM learning_tasks t JOIN students s ON s.id = t.student_id JOIN courses c ON c.id = t.course_id
       WHERE (? IS NULL OR t.course_id = ?) ORDER BY t.due_at IS NULL, t.due_at, t.id`, [courseId, courseId],
    );
    const [progress] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT s.id AS studentId, s.student_id AS studentCode, s.full_name AS studentName,
              e.id AS enrollmentId, e.course_id AS courseId, c.title AS course,
              p.progress_percent AS progress, p.current_topic AS currentTopic
       FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id
       LEFT JOIN course_progress p ON p.enrollment_id = e.id
       WHERE e.status <> 'dropped' AND (? IS NULL OR e.course_id = ?) ORDER BY s.full_name, c.title`, [courseId, courseId],
    );
    const [students] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT s.id, s.student_id AS studentId, s.full_name AS fullName, e.course_id AS courseId
       FROM enrollments e JOIN students s ON s.id = e.student_id
       WHERE e.status = 'active' AND s.status = 'Active' AND (? IS NULL OR e.course_id = ?) ORDER BY s.full_name`, [courseId, courseId],
    );
    return res.json({
      success: true,
      resources: resources.map((row) => ({ ...row, isActive: Boolean(row.isActive) })),
      tasks,
      progress: progress.map((row) => ({ ...row, progress: row.progress === null ? null : Number(row.progress) })),
      students,
    });
  } catch (error) {
    return failure(res, error, 'Learning management records could not be loaded.');
  }
});

router.post('/management/resources', async (req: Request, res: Response) => {
  const courseId = id(req.body?.courseId);
  const title = text(req.body?.title, 255);
  const description = optionalText(req.body?.description, 10000);
  const resourceUrl = optionalText(req.body?.resourceUrl, 2048);
  const resourceType = req.body?.resourceType;
  if (!courseId || !title || description === undefined || resourceUrl === undefined || !(resourceTypes as readonly unknown[]).includes(resourceType)) return res.status(422).json({ success: false, message: 'Provide a valid course, title, resource type, and optional details.' });
  try {
    if (!(await hasRecord('courses', courseId))) return res.status(404).json({ success: false, message: 'Course not found.' });
    const [result] = await getDatabasePool().execute('INSERT INTO resources (course_id, title, description, resource_type, resource_url) VALUES (?, ?, ?, ?, ?)', [courseId, title, description, resourceType, resourceUrl]);
    return res.status(201).json({ success: true, id: (result as { insertId: number | string }).insertId });
  } catch (error) {
    return failure(res, error, 'Resource could not be created.');
  }
});

router.put('/management/resources/:id', async (req: Request, res: Response) => {
  const resourceId = id(req.params.id);
  const courseId = id(req.body?.courseId);
  const title = text(req.body?.title, 255);
  const description = optionalText(req.body?.description, 10000);
  const resourceUrl = optionalText(req.body?.resourceUrl, 2048);
  const resourceType = req.body?.resourceType;
  if (!resourceId || !courseId || !title || description === undefined || resourceUrl === undefined || !(resourceTypes as readonly unknown[]).includes(resourceType) || typeof req.body?.isActive !== 'boolean') return res.status(422).json({ success: false, message: 'Provide valid resource details.' });
  try {
    const [result] = await getDatabasePool().execute('UPDATE resources SET course_id = ?, title = ?, description = ?, resource_type = ?, resource_url = ?, is_active = ? WHERE id = ?', [courseId, title, description, resourceType, resourceUrl, req.body.isActive, resourceId]);
    if ((result as { affectedRows: number }).affectedRows === 0 && !(await hasRecord('resources', resourceId))) return res.status(404).json({ success: false, message: 'Resource not found.' });
    return res.json({ success: true, id: resourceId });
  } catch (error) {
    return failure(res, error, 'Resource could not be updated.');
  }
});

router.post('/management/tasks', async (req: Request, res: Response) => {
  const courseId = id(req.body?.courseId);
  const studentId = req.body?.studentId === '' || req.body?.studentId === null || req.body?.studentId === undefined ? null : id(req.body.studentId);
  const title = text(req.body?.title, 255);
  const description = optionalText(req.body?.description, 10000);
  const dueAt = validDateTime(req.body?.dueAt);
  if (!courseId || !title || description === undefined || dueAt === undefined || (req.body?.studentId && !studentId)) return res.status(422).json({ success: false, message: 'Provide valid task details, course, and deadline.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [enrollments] = await connection.execute<RowDataPacket[]>(
      `SELECT e.student_id, u.id AS userId FROM enrollments e JOIN students s ON s.id = e.student_id
       JOIN users u ON u.id = s.user_id AND u.is_active = TRUE
       WHERE e.course_id = ? AND e.status = 'active' AND s.status = 'Active' AND (? IS NULL OR e.student_id = ?)`,
      [courseId, studentId, studentId],
    );
    if (!enrollments.length) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'No active enrolled students match the task assignment.' });
    }
    for (const enrollment of enrollments) {
      const [taskResult] = await connection.execute(
        'INSERT INTO learning_tasks (student_id, course_id, title, description, due_at) VALUES (?, ?, ?, ?, ?)',
        [enrollment.student_id, courseId, title, description, dueAt],
      );
      await createNotification(connection, {
        userId: Number(enrollment.userId),
        title: 'New learning task',
        message: `${title}${dueAt ? ` · Due ${new Date(dueAt).toLocaleDateString()}` : ''}`,
        type: 'TASK',
        referenceType: 'task',
        referenceId: (taskResult as { insertId: number | string }).insertId,
        dedupeKey: `task:${(taskResult as { insertId: number | string }).insertId}:assigned`,
      });
    }
    await connection.commit();
    return res.status(201).json({ success: true, assignedCount: enrollments.length });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Task could not be created.');
  } finally {
    connection?.release();
  }
});

router.put('/management/tasks/:id', async (req: Request, res: Response) => {
  const taskId = id(req.params.id);
  const title = text(req.body?.title, 255);
  const description = optionalText(req.body?.description, 10000);
  const dueAt = validDateTime(req.body?.dueAt);
  const status = req.body?.status;
  if (!taskId || !title || description === undefined || dueAt === undefined || !(taskStatuses as readonly unknown[]).includes(status)) return res.status(422).json({ success: false, message: 'Provide valid task details and status.' });
  try {
    const [result] = await getDatabasePool().execute(
      `UPDATE learning_tasks SET title = ?, description = ?, due_at = ?, status = ?,
       completed_at = IF(? = 'completed', COALESCE(completed_at, CURRENT_TIMESTAMP), NULL) WHERE id = ?`,
      [title, description, dueAt, status, status, taskId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0 && !(await hasRecord('learning_tasks', taskId))) return res.status(404).json({ success: false, message: 'Task not found.' });
    return res.json({ success: true, id: taskId });
  } catch (error) {
    return failure(res, error, 'Task could not be updated.');
  }
});

router.put('/management/progress', async (req: Request, res: Response) => {
  const studentId = id(req.body?.studentId);
  const courseId = id(req.body?.courseId);
  const progress = Number(req.body?.progress);
  const currentTopic = optionalText(req.body?.currentTopic, 255);
  if (!studentId || !courseId || !Number.isFinite(progress) || progress < 0 || progress > 100 || currentTopic === undefined) return res.status(422).json({ success: false, message: 'Provide a student, course, progress from 0 to 100, and valid topic.' });
  try {
    const [enrollments] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT id FROM enrollments WHERE student_id = ? AND course_id = ? AND status <> 'dropped' LIMIT 1`,
      [studentId, courseId],
    );
    if (!enrollments[0]) return res.status(404).json({ success: false, message: 'Active student enrollment not found for this course.' });
    await getDatabasePool().execute(
      `INSERT INTO course_progress (enrollment_id, progress_percent, current_topic) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE progress_percent = VALUES(progress_percent), current_topic = VALUES(current_topic)`,
      [enrollments[0].id, progress, currentTopic],
    );
    return res.json({ success: true });
  } catch (error) {
    return failure(res, error, 'Student progress could not be updated.');
  }
});

router.get('/management/classes', async (req: Request, res: Response) => {
  const courseId = req.query.courseId === undefined ? null : id(req.query.courseId);
  if (req.query.courseId !== undefined && !courseId) return res.status(400).json({ success: false, message: 'Course ID is invalid.' });
  try {
    const [classes] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT cl.id, cl.course_id AS courseId, c.title AS course, cl.title,
              DATE_FORMAT(cl.starts_at, '%Y-%m-%dT%H:%i:%s') AS startsAt,
              DATE_FORMAT(cl.ends_at, '%Y-%m-%dT%H:%i:%s') AS endsAt,
              cl.instructor, cl.location, cl.meeting_url AS meetingUrl,
              cl.recording_url AS recordingUrl, cl.status
       FROM classes cl JOIN courses c ON c.id = cl.course_id
       WHERE (? IS NULL OR cl.course_id = ?) ORDER BY cl.starts_at DESC LIMIT 300`,
      [courseId, courseId],
    );
    return res.json({ success: true, classes });
  } catch (error) {
    return failure(res, error, 'Classes could not be loaded.');
  }
});

router.get('/management/classes/:id/attendance', async (req: Request, res: Response) => {
  const classId = id(req.params.id);
  if (!classId) return res.status(400).json({ success: false, message: 'Class ID is invalid.' });
  try {
    const [students] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT s.id AS studentId, s.student_id AS studentCode, s.full_name AS fullName,
              a.status AS attendanceStatus
       FROM classes cl JOIN enrollments e ON e.course_id = cl.course_id AND e.status = 'active'
       JOIN students s ON s.id = e.student_id AND s.status = 'Active'
       LEFT JOIN attendance a ON a.class_id = cl.id AND a.student_id = s.id
       WHERE cl.id = ? ORDER BY s.full_name`,
      [classId],
    );
    return res.json({ success: true, students });
  } catch (error) {
    return failure(res, error, 'Class attendance roster could not be loaded.');
  }
});

router.post('/management/classes', async (req: Request, res: Response) => {
  const courseId = id(req.body?.courseId);
  const title = text(req.body?.title, 200);
  const startsAt = validDateTime(req.body?.startsAt);
  const endsAt = validDateTime(req.body?.endsAt);
  const instructor = optionalText(req.body?.instructor, 200);
  const location = optionalText(req.body?.location, 200);
  const meetingUrl = optionalText(req.body?.meetingUrl, 2048);
  const recordingUrl = optionalText(req.body?.recordingUrl, 2048);
  const status = req.body?.status ?? 'scheduled';
  if (!courseId || !title || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || instructor === undefined || location === undefined || meetingUrl === undefined || recordingUrl === undefined || !(classStatuses as readonly unknown[]).includes(status)) return res.status(422).json({ success: false, message: 'Provide valid course, class title, start/end times, and optional class details.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO classes (course_id, title, starts_at, ends_at, instructor, location, meeting_url, recording_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [courseId, title, startsAt, endsAt, instructor, location, meetingUrl, recordingUrl, status],
    );
    const classId = Number((result as { insertId: number | string }).insertId);
    if (status !== 'cancelled') {
      await notifyCourseStudents(connection, courseId, {
        title: 'New class scheduled',
        message: `${title} has been scheduled for ${new Date(startsAt).toLocaleString()}.`,
        type: 'CLASS',
        referenceType: 'class',
        referenceId: classId,
        dedupeKey: `class:${classId}:scheduled:${startsAt}`,
      });
    }
    await connection.commit();
    return res.status(201).json({ success: true, id: classId });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Class could not be created.');
  } finally {
    connection?.release();
  }
});

router.put('/management/classes/:id', async (req: Request, res: Response) => {
  const classId = id(req.params.id);
  const courseId = id(req.body?.courseId);
  const title = text(req.body?.title, 200);
  const startsAt = validDateTime(req.body?.startsAt);
  const endsAt = validDateTime(req.body?.endsAt);
  const instructor = optionalText(req.body?.instructor, 200);
  const location = optionalText(req.body?.location, 200);
  const meetingUrl = optionalText(req.body?.meetingUrl, 2048);
  const recordingUrl = optionalText(req.body?.recordingUrl, 2048);
  const status = req.body?.status;
  if (!classId || !courseId || !title || !startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt) || instructor === undefined || location === undefined || meetingUrl === undefined || recordingUrl === undefined || !(classStatuses as readonly unknown[]).includes(status)) return res.status(422).json({ success: false, message: 'Provide valid class details and status.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [existingRows] = await connection.execute<RowDataPacket[]>(
      'SELECT course_id AS courseId, starts_at AS startsAt, status, title FROM classes WHERE id = ? FOR UPDATE',
      [classId],
    );
    if (!existingRows[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Class not found.' });
    }
    const existing = existingRows[0];
    await connection.execute(
      `UPDATE classes SET course_id = ?, title = ?, starts_at = ?, ends_at = ?, instructor = ?, location = ?,
       meeting_url = ?, recording_url = ?, status = ? WHERE id = ?`,
      [courseId, title, startsAt, endsAt, instructor, location, meetingUrl, recordingUrl, status, classId],
    );
    const scheduleChanged = Number(existing.courseId) !== courseId
      || new Date(existing.startsAt).getTime() !== new Date(startsAt).getTime()
      || existing.status !== status
      || existing.title !== title;
    if (scheduleChanged) {
      const notificationMessage = status === 'cancelled'
        ? `${title} has been cancelled.`
        : `${title} is now ${status.replaceAll('_', ' ')} and scheduled for ${new Date(startsAt).toLocaleString()}.`;
      const eventKey = `class:${classId}:update:${startsAt}:${status}`;
      if (Number(existing.courseId) !== courseId) {
        await notifyCourseStudents(connection, Number(existing.courseId), {
          title: 'Class schedule changed',
          message: `${existing.title} has been removed from its previous course schedule.`,
          type: 'CLASS',
          referenceType: 'class',
          referenceId: classId,
          dedupeKey: `${eventKey}:previous-course`,
        });
      }
      if (status !== 'cancelled') {
        await notifyCourseStudents(connection, courseId, {
          title: 'Class schedule updated',
          message: notificationMessage,
          type: 'CLASS',
          referenceType: 'class',
          referenceId: classId,
          dedupeKey: eventKey,
        });
      } else {
        await notifyCourseStudents(connection, Number(existing.courseId), {
          title: 'Class cancelled',
          message: notificationMessage,
          type: 'CLASS',
          referenceType: 'class',
          referenceId: classId,
          dedupeKey: eventKey,
        });
      }
    }
    await connection.commit();
    return res.json({ success: true, id: classId });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Class could not be updated.');
  } finally {
    connection?.release();
  }
});

router.put('/management/classes/:id/attendance', async (req: Request, res: Response) => {
  const classId = id(req.params.id);
  const attendance = req.body?.attendance;
  if (!classId || !Array.isArray(attendance) || attendance.length > 1000 || attendance.some((entry) => !id(entry?.studentId) || !(attendanceStatuses as readonly unknown[]).includes(entry?.status))) return res.status(422).json({ success: false, message: 'Provide a class and valid attendance records.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    for (const entry of attendance as Array<{ studentId: number; status: (typeof attendanceStatuses)[number] }>) {
      await connection.execute(
        `INSERT INTO attendance (class_id, student_id, status) SELECT ?, s.id, ?
         FROM students s JOIN enrollments e ON e.student_id = s.id
         JOIN classes cl ON cl.id = ? AND cl.course_id = e.course_id
         WHERE s.id = ? AND s.status = 'Active' AND e.status <> 'dropped'
         ON DUPLICATE KEY UPDATE status = VALUES(status), marked_at = CURRENT_TIMESTAMP`,
        [classId, entry.status, classId, entry.studentId],
      );
    }
    await connection.commit();
    return res.json({ success: true, updatedCount: attendance.length });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Attendance could not be recorded.');
  } finally {
    connection?.release();
  }
});

router.get('/management/payments', async (req: Request, res: Response) => {
  const studentId = req.query.studentId === undefined ? null : id(req.query.studentId);
  if (req.query.studentId !== undefined && !studentId) return res.status(400).json({ success: false, message: 'Student ID is invalid.' });
  const period = typeof req.query.period === 'string' ? req.query.period : 'year';
  const today = new Date();
  const dateOnly = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let startDate: string | null = null;
  let endDate: string | null = null;
  if (period === 'today') startDate = dateOnly(today);
  else if (period === 'month') startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
  else if (period === 'quarter') startDate = `${today.getFullYear()}-${String(Math.floor(today.getMonth() / 3) * 3 + 1).padStart(2, '0')}-01`;
  else if (period === 'year') startDate = `${today.getFullYear()}-01-01`;
  else if (period === 'custom') {
    const rawStart = req.query.startDate;
    const rawEnd = req.query.endDate;
    if (typeof rawStart !== 'string' || typeof rawEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(rawStart) || !/^\d{4}-\d{2}-\d{2}$/.test(rawEnd) || rawStart > rawEnd) return res.status(400).json({ success: false, message: 'Choose a valid custom date range.' });
    startDate = rawStart;
    endDate = rawEnd;
  } else return res.status(400).json({ success: false, message: 'Revenue period must be today, month, quarter, year, or custom.' });
  const dateFilter = `${startDate ? ' AND p.payment_date >= ?' : ''}${endDate ? ' AND p.payment_date < DATE_ADD(?, INTERVAL 1 DAY)' : ''}`;
  const dateParams = [startDate, endDate].filter((value): value is string => value !== null);
  try {
    const [payments] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT p.id, p.student_id AS studentId, s.student_id AS studentCode, s.full_name AS studentName,
              p.enrollment_id AS enrollmentId, c.title AS course, p.amount, p.currency,
              p.payment_method AS paymentMethod, p.status,
              DATE_FORMAT(p.payment_date, '%Y-%m-%dT%H:%i:%s') AS paymentDate,
              DATE_FORMAT(p.due_date, '%Y-%m-%d') AS dueDate, p.reference_id AS referenceId, p.receipt_url AS receiptUrl
       FROM payments p JOIN students s ON s.id = p.student_id
       LEFT JOIN enrollments e ON e.id = p.enrollment_id AND e.student_id = p.student_id
       LEFT JOIN courses c ON c.id = e.course_id
       WHERE (? IS NULL OR p.student_id = ?)${dateFilter}
       ORDER BY COALESCE(p.payment_date, p.created_at) DESC, p.id DESC LIMIT 1000`,
      [studentId, studentId, ...dateParams],
    );
    const [totals] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT currency, SUM(status = 'paid' AND payment_date >= CURDATE()) AS today,
              SUM(status = 'paid' AND payment_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')) AS thisMonth,
              SUM(status = 'paid' AND payment_date >= MAKEDATE(YEAR(CURDATE()), 1) + INTERVAL ((QUARTER(CURDATE()) - 1) * 3) MONTH) AS thisQuarter,
              SUM(status = 'paid' AND YEAR(payment_date) = YEAR(CURDATE())) AS thisYear,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END), 0) AS collected,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending
       FROM payments p WHERE p.currency = 'INR'${dateFilter} GROUP BY currency`,
      dateParams,
    );
    return res.json({
      success: true,
      payments: payments.map((row) => ({ ...row, amount: Number(row.amount) })),
      period,
      revenue: totals[0] ? Object.fromEntries(Object.entries(totals[0]).map(([key, value]) => [key, key === 'currency' ? value : Number(value)])) : { currency: 'INR', today: 0, thisMonth: 0, thisQuarter: 0, thisYear: 0, collected: 0, pending: 0 },
    });
  } catch (error) {
    return failure(res, error, 'Payment records could not be loaded.');
  }
});

router.get('/management/enrollments', async (_req: Request, res: Response) => {
  try {
    const [enrollments] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT e.id, e.student_id AS studentId, s.full_name AS studentName,
              e.course_id AS courseId, c.title AS course, e.batch
       FROM enrollments e JOIN students s ON s.id = e.student_id JOIN courses c ON c.id = e.course_id
       WHERE e.status = 'active' AND s.status = 'Active' ORDER BY s.full_name, c.title`,
    );
    return res.json({ success: true, enrollments });
  } catch (error) {
    return failure(res, error, 'Active enrollments could not be loaded.');
  }
});

function parsePayment(body: any) {
  const studentId = id(body?.studentId);
  const enrollmentId = body?.enrollmentId === '' || body?.enrollmentId === null || body?.enrollmentId === undefined ? null : id(body.enrollmentId);
  const amount = Number(body?.amount);
  const paymentDate = validDateTime(body?.paymentDate);
  const dueDate = body?.dueDate === '' || body?.dueDate === null || body?.dueDate === undefined ? null : typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : undefined;
  const method = body?.paymentMethod;
  const status = body?.status;
  const referenceId = optionalText(body?.referenceId, 150);
  const receiptUrl = optionalText(body?.receiptUrl, 2048);
  if (!studentId || !Number.isFinite(amount) || amount <= 0 || amount > 9999999999.99 || paymentDate === undefined || dueDate === undefined || !(paymentMethods as readonly unknown[]).includes(method) || !(paymentStatuses as readonly unknown[]).includes(status) || referenceId === undefined || receiptUrl === undefined || (body?.enrollmentId && !enrollmentId)) return null;
  return { studentId, enrollmentId, amount, paymentDate, dueDate, method, status, referenceId, receiptUrl };
}

router.post('/management/payments', async (req: Request, res: Response) => {
  const payment = parsePayment(req.body);
  if (!payment) return res.status(422).json({ success: false, message: 'Provide valid payment details. Amounts must be positive and payment method/status must be selected.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [students] = await connection.execute<RowDataPacket[]>('SELECT id, user_id AS userId FROM students WHERE id = ?', [payment.studentId]);
    if (!students[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    if (payment.enrollmentId) {
      const [enrollments] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM enrollments WHERE id = ? AND student_id = ? AND status <> 'dropped'`,
        [payment.enrollmentId, payment.studentId],
      );
      if (!enrollments[0]) {
        await connection.rollback();
        return res.status(422).json({ success: false, message: 'Selected enrollment does not belong to this student.' });
      }
    }
    const [result] = await connection.execute(
      `INSERT INTO payments (student_id, enrollment_id, amount, currency, payment_method, payment_date, due_date, status, reference_id, receipt_url)
       VALUES (?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?)`,
      [payment.studentId, payment.enrollmentId, payment.amount, payment.method, payment.paymentDate, payment.dueDate, payment.status, payment.referenceId, payment.receiptUrl],
    );
    const paymentId = Number((result as { insertId: number | string }).insertId);
    const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(payment.amount);
    await createNotification(connection, {
      userId: Number(students[0].userId),
      title: 'Payment recorded',
      message: `${amount} payment record is ${payment.status}.`,
      type: 'PAYMENT',
      referenceType: 'payment',
      referenceId: paymentId,
      dedupeKey: `payment:${paymentId}:recorded`,
    });
    await connection.commit();
    return res.status(201).json({ success: true, id: paymentId });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Payment could not be recorded.');
  } finally {
    connection?.release();
  }
});

router.put('/management/payments/:id', async (req: Request, res: Response) => {
  const paymentId = id(req.params.id);
  const payment = parsePayment(req.body);
  if (!paymentId || !payment) return res.status(422).json({ success: false, message: 'Provide valid payment details.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [students] = await connection.execute<RowDataPacket[]>('SELECT id, user_id AS userId FROM students WHERE id = ?', [payment.studentId]);
    if (!students[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    if (payment.enrollmentId) {
      const [enrollments] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM enrollments WHERE id = ? AND student_id = ? AND status <> 'dropped'`,
        [payment.enrollmentId, payment.studentId],
      );
      if (!enrollments[0]) {
        await connection.rollback();
        return res.status(422).json({ success: false, message: 'Selected enrollment does not belong to this student.' });
      }
    }
    const [currentRows] = await connection.execute<RowDataPacket[]>(
      'SELECT status FROM payments WHERE id = ? FOR UPDATE',
      [paymentId],
    );
    if (!currentRows[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Payment not found.' });
    }
    await connection.execute(
      `UPDATE payments SET student_id = ?, enrollment_id = ?, amount = ?, currency = 'INR', payment_method = ?,
       payment_date = ?, due_date = ?, status = ?, reference_id = ?, receipt_url = ? WHERE id = ?`,
      [payment.studentId, payment.enrollmentId, payment.amount, payment.method, payment.paymentDate, payment.dueDate, payment.status, payment.referenceId, payment.receiptUrl, paymentId],
    );
    if (currentRows[0].status !== payment.status) {
      const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(payment.amount);
      await createNotification(connection, {
        userId: Number(students[0].userId),
        title: 'Payment status updated',
        message: `${amount} payment record is now ${payment.status}.`,
        type: 'PAYMENT',
        referenceType: 'payment',
        referenceId: paymentId,
        dedupeKey: `payment:${paymentId}:status:${randomUUID()}`,
      });
    }
    await connection.commit();
    return res.json({ success: true, id: paymentId });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Payment could not be updated.');
  } finally {
    connection?.release();
  }
});

router.get('/management/certificates', async (_req: Request, res: Response) => {
  try {
    const [certificates] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT cert.id, cert.student_id AS studentId, s.student_id AS studentCode, s.full_name AS studentName,
              cert.course_id AS courseId, c.title AS course, COALESCE(cert.title, c.title) AS title,
              cert.certificate_id AS certificateId, cert.status,
              DATE_FORMAT(cert.issued_at, '%Y-%m-%d') AS issueDate, cert.file_url AS fileUrl
       FROM certificates cert JOIN students s ON s.id = cert.student_id JOIN courses c ON c.id = cert.course_id
       ORDER BY cert.created_at DESC`,
    );
    return res.json({ success: true, certificates });
  } catch (error) {
    return failure(res, error, 'Certificates could not be loaded.');
  }
});

router.post('/management/certificates', async (req: Request, res: Response) => {
  const studentId = id(req.body?.studentId);
  const courseId = id(req.body?.courseId);
  const title = text(req.body?.title, 255);
  const certificateId = text(req.body?.certificateId, 120);
  const issueDate = typeof req.body?.issueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.issueDate) ? req.body.issueDate : null;
  const fileUrl = optionalText(req.body?.fileUrl, 2048);
  if (!studentId || !courseId || !title || !certificateId || !issueDate || fileUrl === undefined) return res.status(422).json({ success: false, message: 'Provide student, course, certificate title and number, issue date, and a valid optional URL.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [enrollments] = await connection.execute<RowDataPacket[]>(
      `SELECT e.id, c.title AS courseTitle FROM enrollments e
       JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = ? AND e.course_id = ? AND e.status <> 'dropped' LIMIT 1`,
      [studentId, courseId],
    );
    if (!enrollments[0]) {
      await connection.rollback();
      return res.status(422).json({ success: false, message: 'Student must be actively enrolled in the selected course.' });
    }
    const [result] = await connection.execute(
      `INSERT INTO certificates (student_id, course_id, title, certificate_id, status, issued_at, file_url)
       VALUES (?, ?, ?, ?, 'issued', ?, ?)`,
      [studentId, courseId, title, certificateId, issueDate, fileUrl],
    );
    const id = Number((result as { insertId: number | string }).insertId);
    const [students] = await connection.execute<RowDataPacket[]>(
      `SELECT u.id AS userId FROM students s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
      [studentId],
    );
    if (!students[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Student account not found.' });
    }
    await createNotification(connection, {
      userId: Number(students[0].userId),
      title: 'Certificate issued',
      message: `${title} for ${enrollments[0].courseTitle ?? 'your course'} is available in your certificate history.`,
      type: 'CERTIFICATE',
      referenceType: 'certificate',
      referenceId: id,
      dedupeKey: `certificate:${id}:issued`,
    });
    await connection.commit();
    return res.status(201).json({ success: true, id });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Certificate could not be issued.');
  } finally {
    connection?.release();
  }
});

router.patch('/management/certificates/:id/status', async (req: Request, res: Response) => {
  const certificateId = id(req.params.id);
  const status = req.body?.status;
  if (!certificateId || !(certificateStatuses as readonly unknown[]).includes(status)) return res.status(422).json({ success: false, message: 'Choose a valid certificate status.' });
  try {
    const connection = await getDatabasePool().getConnection();
    try {
      await connection.beginTransaction();
      const [records] = await connection.execute<RowDataPacket[]>(
        `SELECT cert.status, cert.title, c.title AS course, s.user_id AS userId
         FROM certificates cert JOIN courses c ON c.id = cert.course_id
         JOIN students s ON s.id = cert.student_id WHERE cert.id = ? FOR UPDATE`,
        [certificateId],
      );
      if (!records[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
      }
      await connection.execute(
        `UPDATE certificates SET status = ?, issued_at = IF(? = 'issued', COALESCE(issued_at, CURRENT_TIMESTAMP), issued_at) WHERE id = ?`,
        [status, status, certificateId],
      );
      if (records[0].status !== status) {
        await createNotification(connection, {
          userId: Number(records[0].userId),
          title: status === 'revoked' ? 'Certificate status changed' : 'Certificate status updated',
          message: `${records[0].title ?? records[0].course}: ${status}.`,
          type: 'CERTIFICATE',
          referenceType: 'certificate',
          referenceId: certificateId,
          dedupeKey: `certificate:${certificateId}:status:${randomUUID()}`,
        });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ success: true });
  } catch (error) {
    return failure(res, error, 'Certificate status could not be updated.');
  }
});

router.get('/management/internships', async (_req: Request, res: Response) => {
  try {
    const [internships] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT id, title, organization, description, duration, requirements, skill_requirements AS skillRequirements,
              location, work_mode AS workMode, stipend_amount AS stipendAmount, stipend_currency AS stipendCurrency,
              eligibility, application_url AS applicationUrl,
              DATE_FORMAT(application_deadline, '%Y-%m-%dT%H:%i:%s') AS applicationDeadline,
              is_published AS isPublished
       FROM internships ORDER BY created_at DESC`,
    );
    return res.json({ success: true, internships: internships.map((item) => ({ ...item, isPublished: Boolean(item.isPublished), stipendAmount: item.stipendAmount === null ? null : Number(item.stipendAmount) })) });
  } catch (error) {
    return failure(res, error, 'Internships could not be loaded.');
  }
});

function parseInternship(body: any) {
  const title = text(body?.title, 255);
  const organization = text(body?.organization, 255);
  const description = optionalText(body?.description, 10000);
  const duration = optionalText(body?.duration, 100);
  const location = optionalText(body?.location, 255);
  const workMode = optionalText(body?.workMode, 40);
  const eligibility = optionalText(body?.eligibility, 5000);
  const applicationUrl = optionalText(body?.applicationUrl, 2048);
  const deadline = validDateTime(body?.applicationDeadline);
  const stipend = body?.stipendAmount === '' || body?.stipendAmount === null || body?.stipendAmount === undefined ? null : Number(body.stipendAmount);
  const requirements = body?.requirements === undefined || body?.requirements === null ? null : JSON.stringify(body.requirements);
  const skills = body?.skillRequirements === undefined || body?.skillRequirements === null ? null : JSON.stringify(body.skillRequirements);
  if (!title || !organization || description === undefined || duration === undefined || location === undefined || workMode === undefined || eligibility === undefined || applicationUrl === undefined || deadline === undefined || (stipend !== null && (!Number.isFinite(stipend) || stipend < 0 || stipend > 9999999999.99)) || typeof body?.isPublished !== 'boolean') return null;
  return { title, organization, description, duration, location, workMode, eligibility, applicationUrl, deadline, stipend, requirements, skills, isPublished: body.isPublished };
}

router.post('/management/internships', async (req: Request, res: Response) => {
  const internship = parseInternship(req.body);
  if (!internship) return res.status(422).json({ success: false, message: 'Provide valid opportunity details, stipend, deadline, and publish status.' });
  try {
    const [result] = await getDatabasePool().execute(
      `INSERT INTO internships (title, organization, description, duration, requirements, skill_requirements, location, work_mode, stipend_amount, stipend_currency, eligibility, application_url, application_deadline, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?)`,
      [internship.title, internship.organization, internship.description, internship.duration, internship.requirements, internship.skills, internship.location, internship.workMode, internship.stipend, internship.eligibility, internship.applicationUrl, internship.deadline, internship.isPublished],
    );
    return res.status(201).json({ success: true, id: (result as { insertId: number | string }).insertId });
  } catch (error) {
    return failure(res, error, 'Internship could not be created.');
  }
});

router.put('/management/internships/:id', async (req: Request, res: Response) => {
  const internshipId = id(req.params.id);
  const internship = parseInternship(req.body);
  if (!internshipId || !internship) return res.status(422).json({ success: false, message: 'Provide valid opportunity details.' });
  try {
    const [result] = await getDatabasePool().execute(
      `UPDATE internships SET title = ?, organization = ?, description = ?, duration = ?, requirements = ?,
       skill_requirements = ?, location = ?, work_mode = ?, stipend_amount = ?, stipend_currency = 'INR',
       eligibility = ?, application_url = ?, application_deadline = ?, is_published = ? WHERE id = ?`,
      [internship.title, internship.organization, internship.description, internship.duration, internship.requirements, internship.skills, internship.location, internship.workMode, internship.stipend, internship.eligibility, internship.applicationUrl, internship.deadline, internship.isPublished, internshipId],
    );
    if ((result as { affectedRows: number }).affectedRows === 0 && !(await hasRecord('internships', internshipId))) return res.status(404).json({ success: false, message: 'Internship not found.' });
    return res.json({ success: true, id: internshipId });
  } catch (error) {
    return failure(res, error, 'Internship could not be updated.');
  }
});

router.get('/management/internship-applications', async (req: Request, res: Response) => {
  const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 150) : '';
  if (status && !(internshipApplicationStatuses as readonly string[]).includes(status)) {
    return res.status(400).json({ success: false, message: 'Application status filter is invalid.' });
  }
  try {
    const conditions: string[] = [];
    const parameters: Array<string> = [];
    if (status) {
      conditions.push('a.status = ?');
      parameters.push(status);
    }
    if (search) {
      const pattern = `%${search}%`;
      conditions.push('(i.title LIKE ? OR i.organization LIKE ? OR s.full_name LIKE ? OR s.student_id LIKE ? OR u.email LIKE ?)');
      parameters.push(pattern, pattern, pattern, pattern, pattern);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [applications] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT a.id, a.internship_id AS internshipId, a.student_id AS studentId,
              a.status, a.admin_note AS adminNote,
              DATE_FORMAT(a.applied_at, '%Y-%m-%dT%H:%i:%sZ') AS appliedAt,
              DATE_FORMAT(a.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt,
              i.title AS internshipTitle, i.organization, i.location, i.work_mode AS workMode,
              i.application_deadline AS applicationDeadline,
              s.full_name AS studentName, s.student_id AS studentCode, u.email AS studentEmail
       FROM internship_applications a
       JOIN internships i ON i.id = a.internship_id
       JOIN students s ON s.id = a.student_id
       JOIN users u ON u.id = s.user_id
       ${where}
       ORDER BY a.updated_at DESC, a.id DESC`,
      parameters,
    );
    return res.json({ success: true, applications });
  } catch (error) {
    return failure(res, error, 'Internship applications could not be loaded.');
  }
});

router.patch('/management/internship-applications/:id', async (req: Request, res: Response) => {
  const applicationId = id(req.params.id);
  const update = internshipApplicationUpdateSchema.safeParse(req.body);
  if (!applicationId || !update.success) {
    return res.status(422).json({ success: false, message: 'Provide a valid application status and optional note.' });
  }
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    const [rows] = await connection.execute<RowDataPacket[]>(
      `SELECT a.status, a.admin_note AS adminNote, a.student_id AS studentId,
              s.user_id AS userId, i.title AS internshipTitle
       FROM internship_applications a
       JOIN students s ON s.id = a.student_id
       JOIN internships i ON i.id = a.internship_id
       WHERE a.id = ? FOR UPDATE`,
      [applicationId],
    );
    const existing = rows[0];
    if (!existing) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Internship application not found.' });
    }
    const adminNote = update.data.adminNote === undefined ? existing.adminNote : update.data.adminNote;
    await connection.execute(
      'UPDATE internship_applications SET status = ?, admin_note = ? WHERE id = ?',
      [update.data.status, adminNote, applicationId],
    );
    if (existing.status !== update.data.status || adminNote !== existing.adminNote) {
      const noteText = adminNote ? ` Admin update: ${adminNote}` : '';
      await createNotification(connection, {
        userId: Number(existing.userId),
        title: 'Internship application updated',
        message: `${existing.internshipTitle}: ${update.data.status.replaceAll('_', ' ')}.${noteText}`,
        type: 'INTERNSHIP',
        referenceType: 'internship_application',
        referenceId: applicationId,
        dedupeKey: `internship-application:${applicationId}:update:${randomUUID()}`,
      });
    }
    await connection.commit();
    return res.json({ success: true });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Internship application could not be updated.');
  } finally {
    connection?.release();
  }
});

router.get('/management/announcements', async (_req: Request, res: Response) => {
  try {
    const [announcements] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT a.id, a.title, a.message, a.category, a.target_type AS targetType, a.target_course_id AS targetCourseId,
              c.title AS targetCourse, a.target_student_id AS targetStudentId, s.full_name AS targetStudent,
              a.is_published AS isPublished, DATE_FORMAT(a.scheduled_at, '%Y-%m-%dT%H:%i:%s') AS scheduledAt,
              DATE_FORMAT(a.expires_at, '%Y-%m-%dT%H:%i:%s') AS expiresAt,
              DATE_FORMAT(a.published_at, '%Y-%m-%dT%H:%i:%s') AS publishedAt,
              (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id) AS readCount
       FROM announcements a LEFT JOIN courses c ON c.id = a.target_course_id
       LEFT JOIN students s ON s.id = a.target_student_id ORDER BY a.created_at DESC`,
    );
    return res.json({ success: true, announcements: announcements.map((item) => ({ ...item, isPublished: Boolean(item.isPublished), readCount: Number(item.readCount) })) });
  } catch (error) {
    return failure(res, error, 'Announcements could not be loaded.');
  }
});

function parseAnnouncement(body: any) {
  const title = text(body?.title, 255);
  const message = text(body?.message, 20000);
  const category = body?.category;
  const targetType = body?.targetType;
  const targetCourseId = body?.targetCourseId === '' || body?.targetCourseId === null || body?.targetCourseId === undefined ? null : id(body.targetCourseId);
  const targetStudentId = body?.targetStudentId === '' || body?.targetStudentId === null || body?.targetStudentId === undefined ? null : id(body.targetStudentId);
  const scheduledAt = validDateTime(body?.scheduledAt);
  const expiresAt = validDateTime(body?.expiresAt);
  const isPublished = Boolean(body?.isPublished);
  if (!title || !message || !(announcementCategories as readonly unknown[]).includes(category) || !(announcementTargets as readonly unknown[]).includes(targetType) || scheduledAt === undefined || expiresAt === undefined || (targetType === 'course' && !targetCourseId) || (targetType === 'student' && !targetStudentId) || (body?.targetCourseId && !targetCourseId) || (body?.targetStudentId && !targetStudentId) || (scheduledAt && expiresAt && new Date(expiresAt) <= new Date(scheduledAt))) return null;
  return { title, message, category, targetType, targetCourseId, targetStudentId, scheduledAt, expiresAt, isPublished };
}

router.post('/management/announcements', async (req: Request, res: Response) => {
  const announcement = parseAnnouncement(req.body);
  if (!announcement) return res.status(422).json({ success: false, message: 'Provide valid announcement content, target, and dates.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    if (announcement.targetCourseId) {
      const [courses] = await connection.execute<RowDataPacket[]>('SELECT id FROM courses WHERE id = ?', [announcement.targetCourseId]);
      if (!courses[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Announcement target course was not found.' });
      }
    }
    if (announcement.targetStudentId) {
      const [students] = await connection.execute<RowDataPacket[]>('SELECT id FROM students WHERE id = ?', [announcement.targetStudentId]);
      if (!students[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Announcement target student was not found.' });
      }
    }
    const [result] = await connection.execute(
      `INSERT INTO announcements (title, message, category, target_type, target_course_id, target_student_id, is_published, published_at, scheduled_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, IF(? = 1, CURRENT_TIMESTAMP, NULL), ?, ?)`,
      [announcement.title, announcement.message, announcement.category, announcement.targetType, announcement.targetCourseId, announcement.targetStudentId, announcement.isPublished, announcement.isPublished, announcement.scheduledAt, announcement.expiresAt],
    );
    const announcementId = Number((result as { insertId: number | string }).insertId);
    await notifyPublishedAnnouncement(connection, announcementId);
    await connection.commit();
    return res.status(201).json({ success: true, id: announcementId });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Announcement could not be created.');
  } finally {
    connection?.release();
  }
});

router.put('/management/announcements/:id', async (req: Request, res: Response) => {
  const announcementId = id(req.params.id);
  const announcement = parseAnnouncement(req.body);
  if (!announcementId || !announcement) return res.status(422).json({ success: false, message: 'Provide valid announcement details.' });
  let connection: PoolConnection | undefined;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    if (announcement.targetCourseId) {
      const [courses] = await connection.execute<RowDataPacket[]>('SELECT id FROM courses WHERE id = ?', [announcement.targetCourseId]);
      if (!courses[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Announcement target course was not found.' });
      }
    }
    if (announcement.targetStudentId) {
      const [students] = await connection.execute<RowDataPacket[]>('SELECT id FROM students WHERE id = ?', [announcement.targetStudentId]);
      if (!students[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Announcement target student was not found.' });
      }
    }
    const [existing] = await connection.execute<RowDataPacket[]>('SELECT is_published AS isPublished FROM announcements WHERE id = ? FOR UPDATE', [announcementId]);
    if (!existing[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Announcement not found.' });
    }
    const wasPublished = Boolean(existing[0].isPublished);
    await connection.execute(
      `UPDATE announcements SET title = ?, message = ?, category = ?, target_type = ?, target_course_id = ?,
       target_student_id = ?, is_published = ?, published_at = CASE WHEN ? = 1 THEN COALESCE(published_at, CURRENT_TIMESTAMP) ELSE NULL END,
       scheduled_at = ?, expires_at = ? WHERE id = ?`,
      [announcement.title, announcement.message, announcement.category, announcement.targetType, announcement.targetCourseId, announcement.targetStudentId, announcement.isPublished, announcement.isPublished, announcement.scheduledAt, announcement.expiresAt, announcementId],
    );
    await notifyPublishedAnnouncement(connection, announcementId);
    await connection.commit();
    return res.json({ success: true, wasPublished });
  } catch (error) {
    if (connection) await connection.rollback();
    return failure(res, error, 'Announcement could not be updated.');
  } finally {
    connection?.release();
  }
});

router.delete('/management/announcements/:id', async (req: Request, res: Response) => {
  const announcementId = id(req.params.id);
  if (!announcementId) return res.status(400).json({ success: false, message: 'Announcement ID is invalid.' });
  try {
    const [records] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT a.is_published AS isPublished, (SELECT COUNT(*) FROM announcement_reads r WHERE r.announcement_id = a.id) AS readCount
       FROM announcements a WHERE a.id = ?`, [announcementId],
    );
    if (!records[0]) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    if (Boolean(records[0].isPublished) || Number(records[0].readCount) > 0) return res.status(409).json({ success: false, message: 'Only an unpublished announcement with no student reads can be safely deleted.' });
    await getDatabasePool().execute('DELETE FROM announcements WHERE id = ?', [announcementId]);
    return res.json({ success: true });
  } catch (error) {
    return failure(res, error, 'Announcement could not be deleted.');
  }
});

export default router;
