import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../config/database.js';

dotenv.config();

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.SEED_ADMIN_NAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !name || !password || /SET_DURING|YOUR_PASSWORD|CHANGE_ME|REPLACE/i.test(password) || Buffer.byteLength(password, 'utf8') < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, and a 12-72 byte SEED_ADMIN_PASSWORD in backend/.env.');
  }

  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    const [existing] = await connection.execute<RowDataPacket[]>(
      `SELECT u.id FROM users u INNER JOIN admins a ON a.user_id = u.id WHERE u.email = ? LIMIT 1`,
      [email],
    );
    if (existing.length > 0) {
      console.log('Management account already exists; no changes were made.');
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await connection.beginTransaction();
    const [userResult] = await connection.execute(
      'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, \'ADMIN\', TRUE)',
      [email, passwordHash],
    );
    const userId = Number((userResult as { insertId: number | string }).insertId);
    await connection.execute('INSERT INTO admins (user_id, full_name, email) VALUES (?, ?, ?)', [userId, name, email]);
    await connection.commit();
    console.log(`Management account ${email} was created.`);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

seedAdmin().catch(() => {
  console.error('Admin seed failed. Verify the database schema and required environment settings.');
  process.exitCode = 1;
});