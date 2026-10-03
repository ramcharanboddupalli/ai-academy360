import bcrypt from 'bcrypt';
import { Router, type Request, type Response } from 'express';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { DatabaseConfigurationError, getDatabasePool } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = Router();
router.use(authenticateToken, requireAdmin);

type StudentInput = {
  fullName: string;
  email: string;
  phone: string;
  courseId: number;
  courseIds: number[];
  batch: string;
  joinDate: string;
  password?: string;
};

function parseStudentInput(body: unknown, requirePassword: boolean): { value?: StudentInput; message?: string } {
  if (!body || typeof body !== 'object') return { message: 'Student details are required.' };
  const data = body as Record<string, unknown>;
  const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
  const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
  const rawCourseIds = Array.isArray(data.courseIds) ? data.courseIds : data.courseId === undefined ? [] : [data.courseId];
  const parsedCourseIds = rawCourseIds.map(Number);
  const courseIds = [...new Set(parsedCourseIds)];
  const courseId = courseIds[0];
  const batch = typeof data.batch === 'string' ? data.batch.trim() : '';
  const joinDate = typeof data.joinDate === 'string' ? data.joinDate : '';
  const password = typeof data.password === 'string' ? data.password : undefined;

  if (fullName.length < 2 || fullName.length > 200) return { message: 'Full name must be between 2 and 200 characters.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { message: 'Enter a valid email address.' };
  if (phone.length < 5 || phone.length > 40) return { message: 'Enter a valid phone number.' };
  if (rawCourseIds.length < 1 || rawCourseIds.length > 20 || parsedCourseIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
    return { message: 'Select at least one valid course.' };
  }
  if (!batch || batch.length > 80) return { message: 'Batch is required and must be at most 80 characters.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(joinDate)) return { message: 'Enter a valid join date.' };
  const [year, month, day] = joinDate.split('-').map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (parsedDate.toISOString().slice(0, 10) !== joinDate) return { message: 'Enter a valid join date.' };
  if (requirePassword && (typeof password !== 'string' || Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72)) {
    return { message: 'Initial password must be between 8 and 72 bytes.' };
  }

  return { value: { fullName, email, phone, courseId, courseIds, batch, joinDate, password } };
}

function handleFailure(res: Response, error: unknown, message: string) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'Database is not configured.' });
  }
  if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  }
  return res.status(500).json({ success: false, message });
}

async function getStudent(connection: Pool | PoolConnection, studentId: number) {
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT s.id, s.student_id AS studentId, s.full_name AS fullName, s.email, s.phone,
            s.course_id AS courseId, c.title AS course, s.batch,
            DATE_FORMAT(s.join_date, '%Y-%m-%d') AS joinDate, s.status
     FROM students s INNER JOIN courses c ON c.id = s.course_id WHERE s.id = ? LIMIT 1`,
    [studentId],
  );
  if (!rows[0]) return undefined;
  const [courses] = await connection.execute<RowDataPacket[]>(
    `SELECT c.id, c.code, c.title AS name
     FROM enrollments e INNER JOIN courses c ON c.id = e.course_id
    WHERE e.student_id = ? AND e.status <> 'dropped' ORDER BY c.title`,
    [studentId],
  );
  return { ...rows[0], courses };
}

async function getEnrolledCourses(connection: Pool | PoolConnection, studentIds: number[]) {
  const coursesByStudent = new Map<number, Array<{ id: number | string; code: string; name: string }>>();
  if (studentIds.length === 0) return coursesByStudent;
  const placeholders = studentIds.map(() => '?').join(', ');
  const [rows] = await connection.execute<RowDataPacket[]>(
    `SELECT e.student_id AS studentRecordId, c.id, c.code, c.title AS name
     FROM enrollments e INNER JOIN courses c ON c.id = e.course_id
    WHERE e.student_id IN (${placeholders}) AND e.status <> 'dropped' ORDER BY c.title`,
    studentIds,
  );
  for (const row of rows) {
    const studentRecordId = Number(row.studentRecordId);
    const courses = coursesByStudent.get(studentRecordId) ?? [];
    courses.push({ id: row.id, code: row.code, name: row.name });
    coursesByStudent.set(studentRecordId, courses);
  }
  return coursesByStudent;
}

router.get('/courses', async (_req: Request, res: Response) => {
  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      'SELECT id, code, title AS name FROM courses WHERE is_active = TRUE ORDER BY title',
    );
    return res.json({ success: true, courses: rows });
  } catch (error) {
    return handleFailure(res, error, 'Courses could not be loaded.');
  }
});

router.get('/students', async (_req: Request, res: Response) => {
  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT s.id, s.student_id AS studentId, s.full_name AS fullName, s.email, s.phone,
              s.course_id AS courseId, c.title AS course, s.batch,
              DATE_FORMAT(s.join_date, '%Y-%m-%d') AS joinDate, s.status
       FROM students s INNER JOIN courses c ON c.id = s.course_id ORDER BY s.created_at DESC`,
    );
    const coursesByStudent = await getEnrolledCourses(getDatabasePool(), rows.map((row) => Number(row.id)));
    const students = rows.map((student) => ({
      ...student,
      courses: coursesByStudent.get(Number(student.id)) ?? [],
    }));
    return res.json({ success: true, students });
  } catch (error) {
    return handleFailure(res, error, 'Students could not be loaded.');
  }
});

router.post('/students', async (req: Request, res: Response) => {
  const parsed = parseStudentInput(req.body, true);
  if (!parsed.value) return res.status(400).json({ success: false, message: parsed.message });

  const input = parsed.value;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    const passwordHash = await bcrypt.hash(input.password!, 12);
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;

    const [existingUsers] = await connection.execute<RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [input.email]);
    if (existingUsers.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const coursePlaceholders = input.courseIds.map(() => '?').join(', ');
    const [courses] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM courses WHERE id IN (${coursePlaceholders}) AND is_active = TRUE`,
      input.courseIds,
    );
    if (courses.length !== input.courseIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Select an active course.' });
    }

    const academicYear = new Date().getUTCFullYear();
    await connection.execute(
      'INSERT INTO student_id_sequences (academic_year, last_sequence) VALUES (?, 0) ON DUPLICATE KEY UPDATE academic_year = VALUES(academic_year)',
      [academicYear],
    );
    const [sequenceRows] = await connection.execute<RowDataPacket[]>(
      'SELECT last_sequence AS lastSequence FROM student_id_sequences WHERE academic_year = ? FOR UPDATE',
      [academicYear],
    );
    const sequence = Number(sequenceRows[0].lastSequence) + 1;
    await connection.execute('UPDATE student_id_sequences SET last_sequence = ? WHERE academic_year = ?', [sequence, academicYear]);
    const studentId = `ACA${String(academicYear).slice(-2)}ST${String(sequence).padStart(3, '0')}`;

    const [userResult] = await connection.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, \'STUDENT\', TRUE)',
      [input.email, passwordHash],
    );
    const userId = Number((userResult as { insertId: number | string }).insertId);
    const [studentResult] = await connection.execute(
      `INSERT INTO students (user_id, student_id, full_name, email, phone, course_id, batch, join_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')`,
      [userId, studentId, input.fullName, input.email, input.phone, input.courseId, input.batch, input.joinDate],
    );
    const studentRecordId = Number((studentResult as { insertId: number | string }).insertId);
    for (const courseId of input.courseIds) {
      await connection.execute(
        'INSERT INTO enrollments (student_id, course_id, batch, status) VALUES (?, ?, ?, \'active\')',
        [studentRecordId, courseId, input.batch],
      );
    }
    const student = await getStudent(connection, studentRecordId);
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({ success: true, student });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    return handleFailure(res, error, 'Student account could not be created.');
  } finally {
    connection?.release();
  }
});

router.get('/students/:id', async (req: Request, res: Response) => {
  const studentRecordId = Number(req.params.id);
  if (!Number.isSafeInteger(studentRecordId) || studentRecordId < 1) {
    return res.status(400).json({ success: false, message: 'Student record ID is invalid.' });
  }

  try {
    const student = await getStudent(getDatabasePool(), studentRecordId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found.' });
    return res.json({ success: true, student });
  } catch (error) {
    return handleFailure(res, error, 'Student could not be loaded.');
  }
});

router.put('/students/:id', async (req: Request, res: Response) => {
  const studentRecordId = Number(req.params.id);
  if (!Number.isSafeInteger(studentRecordId) || studentRecordId < 1) {
    return res.status(400).json({ success: false, message: 'Student record ID is invalid.' });
  }
  const parsed = parseStudentInput(req.body, false);
  if (!parsed.value) return res.status(400).json({ success: false, message: parsed.message });
  const input = parsed.value;
  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [records] = await connection.execute<RowDataPacket[]>('SELECT user_id AS userId FROM students WHERE id = ? FOR UPDATE', [studentRecordId]);
    if (!records[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const userId = Number(records[0].userId);
    const [duplicate] = await connection.execute<RowDataPacket[]>('SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1', [input.email, userId]);
    if (duplicate.length > 0) {
      await connection.rollback();
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    const coursePlaceholders = input.courseIds.map(() => '?').join(', ');
    const [courses] = await connection.execute<RowDataPacket[]>(
      `SELECT id FROM courses WHERE id IN (${coursePlaceholders}) AND is_active = TRUE`,
      input.courseIds,
    );
    if (courses.length !== input.courseIds.length) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'Select an active course.' });
    }

    await connection.execute('UPDATE users SET email = ? WHERE id = ?', [input.email, userId]);
    await connection.execute(
      `UPDATE students SET full_name = ?, email = ?, phone = ?, course_id = ?, batch = ?, join_date = ? WHERE id = ?`,
      [input.fullName, input.email, input.phone, input.courseId, input.batch, input.joinDate, studentRecordId],
    );
    await connection.execute(
      `UPDATE enrollments SET status = 'dropped'
       WHERE student_id = ? AND status = 'active' AND course_id NOT IN (${coursePlaceholders})`,
      [studentRecordId, ...input.courseIds],
    );
    for (const courseId of input.courseIds) {
      await connection.execute(
        `INSERT INTO enrollments (student_id, course_id, batch, status) VALUES (?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE batch = VALUES(batch), status = 'active'`,
        [studentRecordId, courseId, input.batch],
      );
    }
    const student = await getStudent(connection, studentRecordId);
    await connection.commit();
    transactionStarted = false;
    return res.json({ success: true, student });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    return handleFailure(res, error, 'Student account could not be updated.');
  } finally {
    connection?.release();
  }
});

router.patch('/students/:id/status', async (req: Request, res: Response) => {
  const studentRecordId = Number(req.params.id);
  const status = req.body?.status;
  if (!Number.isSafeInteger(studentRecordId) || studentRecordId < 1) {
    return res.status(400).json({ success: false, message: 'Student record ID is invalid.' });
  }
  if (status !== 'Active' && status !== 'Inactive') {
    return res.status(400).json({ success: false, message: 'Status must be Active or Inactive.' });
  }

  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    connection = await getDatabasePool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [records] = await connection.execute<RowDataPacket[]>('SELECT user_id AS userId FROM students WHERE id = ? FOR UPDATE', [studentRecordId]);
    if (!records[0]) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    const isActive = status === 'Active';
    await connection.execute('UPDATE students SET status = ? WHERE id = ?', [status, studentRecordId]);
    await connection.execute('UPDATE users SET is_active = ? WHERE id = ?', [isActive, records[0].userId]);
    const student = await getStudent(connection, studentRecordId);
    await connection.commit();
    transactionStarted = false;
    return res.json({ success: true, student });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    return handleFailure(res, error, 'Student status could not be updated.');
  } finally {
    connection?.release();
  }
});

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(`
      SELECT
        (SELECT COUNT(*) FROM students) AS totalStudents,
        (SELECT COUNT(*) FROM students WHERE status = 'Active') AS activeStudents,
        (SELECT COUNT(*) FROM students WHERE status = 'Inactive') AS inactiveStudents,
        (SELECT COUNT(*) FROM courses WHERE is_active = TRUE) AS totalCourses,
        (SELECT COUNT(*) FROM enrollments WHERE status = 'active') AS activeEnrollments,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'paid') AS totalFeesCollected,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'pending') AS pendingFees,
        (SELECT COUNT(*) FROM classes WHERE status IN ('scheduled', 'live') AND starts_at >= NOW()) AS upcomingClasses,
        (SELECT COUNT(*) FROM tickets WHERE status = 'open') AS openSupportTickets,
        (SELECT COALESCE(AVG(cp.progress_percent), 0) FROM course_progress cp
         JOIN enrollments e ON e.id = cp.enrollment_id AND e.status = 'active') AS averageCourseProgress,
        (SELECT COALESCE(AVG(attendance_percent), 0) FROM (
          SELECT (COUNT(CASE WHEN status = 'present' THEN 1 END) / NULLIF(COUNT(*), 0)) * 100 AS attendance_percent
          FROM attendance
          GROUP BY student_id
        ) attendance_summary) AS averageAttendance,
        (SELECT COUNT(*) FROM learning_tasks WHERE status IN ('pending', 'in_progress')) AS activeLearningTasks,
        (SELECT COUNT(*) FROM learning_tasks WHERE status = 'completed') AS completedTasks,
        (SELECT COUNT(*) FROM students WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS newStudents,
        (SELECT COUNT(*) FROM enrollments WHERE enrolled_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS recentEnrollments,
        (SELECT COUNT(*) FROM tickets WHERE priority IN ('high', 'urgent') AND status NOT IN ('resolved', 'closed')) AS highPriorityTickets,
        (SELECT COUNT(*) FROM tickets WHERE status = 'in_progress') AS inProgressSupportTickets,
        (SELECT COUNT(*) FROM tickets WHERE status IN ('resolved', 'closed')) AS resolvedSupportTickets,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'paid') AS totalCollected,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'pending') AS pendingRevenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'pending' AND due_date < CURDATE()) AS overdueRevenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'paid' AND payment_date >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS thisMonthRevenue,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE currency = 'INR' AND status = 'paid' AND YEAR(payment_date) = YEAR(NOW())) AS thisYearRevenue
    `);

    const row = rows[0] as Record<string, unknown> | undefined;
    const parseNumber = (value: unknown) => Number(value ?? 0);
    const roundPercent = (value: number) => Number(Math.max(0, value).toFixed(2));

    const dashboard = {
      totalStudents: parseNumber(row?.totalStudents),
      activeStudents: parseNumber(row?.activeStudents),
      inactiveStudents: parseNumber(row?.inactiveStudents),
      totalCourses: parseNumber(row?.totalCourses),
      activeEnrollments: parseNumber(row?.activeEnrollments),
      totalFeesCollected: parseNumber(row?.totalFeesCollected),
      pendingFees: parseNumber(row?.pendingFees),
      upcomingClasses: parseNumber(row?.upcomingClasses),
      openSupportTickets: parseNumber(row?.openSupportTickets),
      averageCourseProgress: roundPercent(parseNumber(row?.averageCourseProgress)),
      averageAttendance: roundPercent(parseNumber(row?.averageAttendance)),
      activeLearningTasks: parseNumber(row?.activeLearningTasks),
      completedTasks: parseNumber(row?.completedTasks),
      newStudents: parseNumber(row?.newStudents),
      recentEnrollments: parseNumber(row?.recentEnrollments),
      highPriorityTickets: parseNumber(row?.highPriorityTickets),
      inProgressSupportTickets: parseNumber(row?.inProgressSupportTickets),
      resolvedSupportTickets: parseNumber(row?.resolvedSupportTickets),
      totalCollected: parseNumber(row?.totalCollected),
      pendingRevenue: parseNumber(row?.pendingRevenue),
      overdueRevenue: parseNumber(row?.overdueRevenue),
      thisMonthRevenue: parseNumber(row?.thisMonthRevenue),
      thisYearRevenue: parseNumber(row?.thisYearRevenue),
      openTickets: parseNumber(row?.openSupportTickets),
      inProgress: parseNumber(row?.inProgressSupportTickets),
      resolved: parseNumber(row?.resolvedSupportTickets),
      pending: parseNumber(row?.pendingRevenue),
      overdue: parseNumber(row?.overdueRevenue),
      thisMonth: parseNumber(row?.thisMonthRevenue),
      thisYear: parseNumber(row?.thisYearRevenue),
    };

    return res.json({
      success: true,
      userId: req.authUser?.id,
      studentCount: dashboard.totalStudents,
      ...dashboard,
      dashboard,
    });
  } catch (error) {
    return handleFailure(res, error, 'Dashboard data could not be loaded.');
  }
});

export default router;