import bcrypt from 'bcrypt';
import { Router, type Request, type Response } from 'express';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { DatabaseConfigurationError, getDatabasePool } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { createAccessToken } from '../services/auth.service.js';

const router = Router();
const invalidCredentials = { success: false, message: 'Invalid email or password.' };
const invalidStudentCredentials = { success: false, message: 'Invalid Student ID or password.' };

const managementSignupSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required.').max(200, 'Full name must be 200 characters or fewer.'),
  email: z.string().trim().email('Enter a valid email address.').max(254, 'Email must be 254 characters or fewer.').transform((email) => email.toLowerCase()),
  password: z.string().min(12, 'Password must be at least 12 characters.'),
  confirmPassword: z.string().min(1, 'Confirm your password.'),
}).superRefine(({ password, confirmPassword }, context) => {
  if (password !== confirmPassword) {
    context.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    context.addIssue({ code: 'custom', path: ['password'], message: 'Password must be no more than 72 UTF-8 bytes.' });
  }
});

const managementLoginSchema = z.object({
  email: z.string().trim().email().transform((email) => email.toLowerCase()),
  password: z.string().min(1),
});

const studentLoginSchema = z.object({
  studentId: z.string().trim().min(1),
  password: z.string().min(1),
});

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

function handleUnavailable(res: Response, error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'Database is not configured.' });
  }
  return res.status(503).json({ success: false, message: 'Authentication service is unavailable.' });
}

router.post('/management/signup', async (req: Request, res: Response) => {
  const parsed = managementSignupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message ?? 'Signup details are invalid.' });
  }

  const { fullName, email, password } = parsed.data;
  if (Buffer.byteLength(password, 'utf8') < 12) {
    return res.status(400).json({ success: false, message: 'Password must be at least 12 UTF-8 bytes.' });
  }

  let connection: PoolConnection | undefined;
  let transactionStarted = false;
  try {
    const pool = getDatabasePool();
    connection = await pool.getConnection();
    const [existingUsers] = await connection.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email],
    );
    if (existingUsers.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.beginTransaction();
    transactionStarted = true;

    const [userResult] = await connection.execute<ResultSetHeader>(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, \'ADMIN\', TRUE)',
      [email, passwordHash],
    );
    await connection.execute(
      'INSERT INTO admins (user_id, full_name, email) VALUES (?, ?, ?)',
      [userResult.insertId, fullName, email],
    );
    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      success: true,
      message: 'Management account created. Sign in to continue.',
      user: { id: Number(userResult.insertId), role: 'ADMIN', name: fullName },
    });
  } catch (error) {
    if (transactionStarted && connection) {
      try {
        await connection.rollback();
      } catch {
        return res.status(503).json({ success: false, message: 'Management signup could not be completed safely.' });
      }
    }
    if (isDuplicateEntry(error)) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    return handleUnavailable(res, error);
  } finally {
    connection?.release();
  }
});

async function managementLogin(req: Request, res: Response) {
  const parsed = managementLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  const { email, password } = parsed.data;
  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT u.id, u.password_hash AS passwordHash, u.role, u.is_active AS isActive, a.full_name AS name
       FROM users u INNER JOIN admins a ON a.user_id = u.id
       WHERE u.email = ? LIMIT 1`,
      [email],
    );
    const admin = rows[0];
    if (!admin || admin.role !== 'ADMIN' || !admin.isActive || !(await bcrypt.compare(password, admin.passwordHash))) {
      return res.status(401).json(invalidCredentials);
    }

    const { token } = createAccessToken(Number(admin.id), 'ADMIN');
    return res.json({ success: true, token, user: { id: Number(admin.id), role: 'ADMIN', name: admin.name } });
  } catch (error) {
    return handleUnavailable(res, error);
  }
}

router.post('/management/login', managementLogin);

router.post('/student/login', async (req: Request, res: Response) => {
  const parsed = studentLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Student ID and password are required.' });
  }

  const { studentId, password } = parsed.data;
  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT u.id, u.password_hash AS passwordHash, u.role, u.is_active AS isActive,
              s.student_id AS studentId, s.full_name AS name
       FROM students s INNER JOIN users u ON u.id = s.user_id
       WHERE s.student_id = ? LIMIT 1`,
      [studentId.trim().toUpperCase()],
    );
    const student = rows[0];
    if (!student || student.role !== 'STUDENT' || !student.isActive || !(await bcrypt.compare(password, student.passwordHash))) {
      return res.status(401).json(invalidStudentCredentials);
    }

    const { token } = createAccessToken(Number(student.id), 'STUDENT');
    return res.json({
      success: true,
      token,
      user: { id: Number(student.id), studentId: student.studentId, role: 'STUDENT', name: student.name },
    });
  } catch (error) {
    return handleUnavailable(res, error);
  }
});

router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const identity = req.authUser!;
    const query = identity.role === 'ADMIN'
      ? `SELECT u.id, u.role, a.full_name AS name, NULL AS studentId
         FROM users u INNER JOIN admins a ON a.user_id = u.id WHERE u.id = ? AND u.is_active = TRUE`
      : `SELECT u.id, u.role, s.full_name AS name, s.student_id AS studentId
         FROM users u INNER JOIN students s ON s.user_id = u.id WHERE u.id = ? AND u.is_active = TRUE`;
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(query, [identity.id]);
    if (!rows[0]) return res.status(401).json({ success: false, message: 'Account is unavailable.' });
    return res.json({ success: true, user: { ...rows[0], id: Number(rows[0].id) } });
  } catch (error) {
    return handleUnavailable(res, error);
  }
});

router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const identity = req.authUser!;
    await getDatabasePool().execute(
      'INSERT INTO token_revocations (token_id, expires_at) VALUES (?, FROM_UNIXTIME(?))',
      [identity.tokenId, identity.expiresAt],
    );
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    return handleUnavailable(res, error);
  }
});

export default router;