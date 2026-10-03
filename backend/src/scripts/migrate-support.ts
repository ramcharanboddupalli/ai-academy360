import dotenv from 'dotenv';
import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../config/database.js';
import { DEFAULT_AI_DEPARTMENTS } from '../services/ai/ai.schema.js';

dotenv.config();

async function migrateSupport() {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    const [columns] = await connection.execute<RowDataPacket[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tickets' AND COLUMN_NAME = 'source'`,
    );
    if (columns.length === 0) {
      await connection.query("ALTER TABLE tickets ADD COLUMN source VARCHAR(40) NOT NULL DEFAULT 'student_support' AFTER department_id");
      console.log('Added tickets.source without dropping or resetting ticket data.');
    } else {
      console.log('tickets.source already exists; no schema change was needed.');
    }

    const descriptions: Record<(typeof DEFAULT_AI_DEPARTMENTS)[number], string> = {
      student_support: 'General student support requests',
      academic_advising: 'Course enrollment and academic advising',
      finance: 'Payments and billing support',
      it_support: 'Technical support for academy systems',
      admin_ops: 'Administrative operations',
      faculty: 'Faculty and instructor support',
    };
    for (const department of DEFAULT_AI_DEPARTMENTS) {
      await connection.execute('INSERT IGNORE INTO departments (name, description) VALUES (?, ?)', [department, descriptions[department]]);
    }
    const [departmentRows] = await connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM departments');
    console.log(`Support department catalog is ready (${Number(departmentRows[0].total)} departments).`);
  } finally {
    connection.release();
    await pool.end();
  }
}

migrateSupport().catch(() => {
  console.error('Support database migration failed. Verify database access and the existing ticket schema.');
  process.exitCode = 1;
});