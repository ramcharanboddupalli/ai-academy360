import dotenv from 'dotenv';
import { getDatabasePool } from '../config/database.js';

dotenv.config();

async function migrateAnalytics() {
  const pool = getDatabasePool();
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS ai_management_insights (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      generated_by BIGINT UNSIGNED NOT NULL,
      period ENUM('last_7_days', 'last_30_days', 'last_90_days') NOT NULL,
      provider VARCHAR(40) NOT NULL,
      model VARCHAR(120) NOT NULL,
      input_snapshot JSON NOT NULL,
      summary TEXT NOT NULL,
      key_issues JSON NOT NULL,
      risk_areas JSON NOT NULL,
      recommendations JSON NOT NULL,
      priority_action TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_ai_management_insights_created (created_at),
      KEY idx_ai_management_insights_period (period, created_at),
      CONSTRAINT fk_ai_management_insights_admin FOREIGN KEY (generated_by) REFERENCES users(id)
    ) ENGINE=InnoDB`);
    console.log('AI management insight history table is ready. Existing records were preserved.');
  } finally {
    await pool.end();
  }
}

migrateAnalytics().catch(() => {
  console.error('AI management insight migration failed. Verify MySQL connectivity and schema permissions.');
  process.exitCode = 1;
});