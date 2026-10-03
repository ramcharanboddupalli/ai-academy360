import dotenv from 'dotenv';
import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../config/database.js';

dotenv.config();

const additions: Array<{ table: string; column: string; definition: string }> = [
  { table: 'courses', column: 'instructor', definition: 'VARCHAR(200) NULL' },
  { table: 'classes', column: 'meeting_url', definition: 'VARCHAR(2048) NULL' },
  { table: 'payments', column: 'payment_method', definition: "ENUM('upi', 'bank_transfer', 'cash', 'card', 'other') NULL" },
  { table: 'payments', column: 'due_date', definition: 'DATE NULL' },
  { table: 'internships', column: 'location', definition: 'VARCHAR(255) NULL' },
  { table: 'internships', column: 'work_mode', definition: "VARCHAR(40) NULL" },
  { table: 'internships', column: 'stipend_amount', definition: 'DECIMAL(12,2) NULL' },
  { table: 'internships', column: 'stipend_currency', definition: "CHAR(3) NOT NULL DEFAULT 'INR'" },
  { table: 'internships', column: 'eligibility', definition: 'TEXT NULL' },
  { table: 'internships', column: 'application_url', definition: 'VARCHAR(2048) NULL' },
  { table: 'announcements', column: 'scheduled_at', definition: 'DATETIME NULL' },
  { table: 'announcements', column: 'expires_at', definition: 'DATETIME NULL' },
  { table: 'certificates', column: 'title', definition: 'VARCHAR(255) NULL' },
  { table: 'internship_applications', column: 'admin_note', definition: 'TEXT NULL' },
  { table: 'notifications', column: 'notification_type', definition: "VARCHAR(40) NOT NULL DEFAULT 'SYSTEM'" },
  { table: 'notifications', column: 'reference_type', definition: 'VARCHAR(40) NULL' },
  { table: 'notifications', column: 'reference_id', definition: 'VARCHAR(120) NULL' },
  { table: 'notifications', column: 'dedupe_key', definition: 'VARCHAR(191) NULL' },
];

async function migrate() {
  const pool = getDatabasePool();
  try {
    for (const { table, column, definition } of additions) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column],
      );
      if (rows.length === 0) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
    const [dedupeIndex] = await pool.execute<RowDataPacket[]>(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND INDEX_NAME = 'uq_notifications_dedupe_key'`,
    );
    if (dedupeIndex.length === 0) {
      await pool.query('ALTER TABLE notifications ADD UNIQUE KEY uq_notifications_dedupe_key (dedupe_key)');
    }
    await pool.query(
      `ALTER TABLE internship_applications MODIFY COLUMN status
       ENUM('applied', 'under_review', 'shortlisted', 'in_progress', 'completed', 'rejected', 'selected', 'withdrawn')
       NOT NULL DEFAULT 'applied'`,
    );
    await pool.query("ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'INR'");
    console.log('Admin management schema is ready. Existing records were preserved.');
  } finally {
    await pool.end();
  }
}

migrate().catch(() => {
  console.error('Admin management migration failed. Check MySQL connectivity, base schema, and permissions.');
  process.exitCode = 1;
});
