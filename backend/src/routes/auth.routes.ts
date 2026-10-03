import bcrypt from 'bcrypt';
import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2';
import { DatabaseConfigurationError, getDatabasePool } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { createAccessToken } from '../services/auth.service.js';

const router = Router();
const invalidCredentials = { success: false, message: 'Invalid email or password.' };
const invalidStudentCredentials = { success: false, message: 'Invalid Student ID or password.' };

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function handleUnavailable(res: Response, error: unknown) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'Database is not configured.' });
  }
  return res.status(503).json({ success: false, message: 'Authentication service is unavailable.' });
}

router.post('/admin/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  if (!isText(email) || !isText(password)) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT u.id, u.password_hash AS passwordHash, u.role, u.is_active AS isActive, a.full_name AS name
       FROM users u INNER JOIN admins a ON a.user_id = u.id
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()],
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
});

router.post('/student/login', async (req: Request, res: Response) => {
  const { studentId, password } = req.body ?? {};
  if (!isText(studentId) || !isText(password)) {
    return res.status(400).json({ success: false, message: 'Student ID and password are required.' });
  }

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