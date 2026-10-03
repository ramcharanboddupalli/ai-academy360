import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { getDatabasePool } from '../config/database.js';

dotenv.config();

async function migrateStudentDashboard() {
  const schemaPath = resolve(process.cwd(), '..', 'database', 'student-dashboard-schema.sql');
  const schema = await readFile(schemaPath, 'utf8');
  const statements = schema.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
  const pool = getDatabasePool();
  try {
    for (const statement of statements) await pool.query(statement);
    console.log('Student dashboard tables are ready. Existing data was preserved.');
  } finally {
    await pool.end();
  }
}

migrateStudentDashboard().catch(() => {
  console.error('Student dashboard migration failed. Verify MySQL connectivity and schema permissions.');
  process.exitCode = 1;
});