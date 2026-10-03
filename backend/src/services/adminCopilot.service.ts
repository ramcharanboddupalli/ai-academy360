import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../config/database.js';

function toCountBreakdown(rows: RowDataPacket[]) {
  return rows.map((row) => ({ label: String(row.label ?? 'Uncategorized'), total: Number(row.total) }));
}

export async function getAdminCopilotSnapshot() {
  const pool = getDatabasePool();
  const [
    [academyRows],
    [courseRows],
    [lowAttendanceRows],
    [complaintStatusRows],
    [complaintPriorityRows],
    [complaintCategoryRows],
    [revenueRows],
  ] = await Promise.all([
    pool.execute<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM students) AS totalStudents,
         (SELECT COUNT(*) FROM students WHERE status = 'Active') AS activeStudents,
         (SELECT COUNT(*) FROM enrollments WHERE status = 'active') AS activeEnrollments,
         (SELECT COUNT(*) FROM courses WHERE is_active = TRUE) AS activeCourses,
         (SELECT COUNT(*) FROM tickets WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)) AS complaintsLast30Days`,
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT c.title AS course,
              (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') AS activeEnrollments,
              (SELECT COUNT(*) FROM learning_tasks t WHERE t.course_id = c.id AND t.status IN ('pending', 'in_progress')) AS pendingTasks
       FROM courses c WHERE c.is_active = TRUE ORDER BY c.title`,
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT s.student_id AS studentCode, c.title AS course,
              SUM(a.status IN ('present', 'late')) AS attendedClasses,
              COUNT(*) AS recordedClasses,
              ROUND(SUM(a.status IN ('present', 'late')) * 100 / COUNT(*), 2) AS attendancePercent
       FROM attendance a
       JOIN students s ON s.id = a.student_id AND s.status = 'Active'
       JOIN classes cl ON cl.id = a.class_id
       JOIN courses c ON c.id = cl.course_id
       GROUP BY s.id, s.student_id, c.id, c.title
       HAVING COUNT(*) > 0
       ORDER BY attendancePercent ASC, recordedClasses DESC, s.student_id
       LIMIT 10`,
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT status AS label, COUNT(*) AS total FROM tickets
       WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
       GROUP BY status ORDER BY status`,
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT priority AS label, COUNT(*) AS total FROM tickets
       WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
       GROUP BY priority ORDER BY FIELD(priority, 'urgent', 'high', 'medium', 'low')`,
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT category AS label, COUNT(*) AS total FROM tickets
       WHERE created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
         AND category IS NOT NULL AND category <> ''
       GROUP BY category ORDER BY total DESC, category`,
    ),
    pool.execute<RowDataPacket[]>(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'paid'
           AND COALESCE(payment_date, created_at) >= DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')
           THEN amount ELSE 0 END), 0) AS collectedThisMonth,
         COALESCE(SUM(CASE WHEN status = 'paid'
           AND YEAR(COALESCE(payment_date, created_at)) = YEAR(CURRENT_DATE)
           AND QUARTER(COALESCE(payment_date, created_at)) = QUARTER(CURRENT_DATE)
           THEN amount ELSE 0 END), 0) AS collectedThisQuarter,
         COALESCE(SUM(CASE WHEN status = 'paid'
           AND YEAR(COALESCE(payment_date, created_at)) = YEAR(CURRENT_DATE)
           THEN amount ELSE 0 END), 0) AS collectedThisYear,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pendingINR
       FROM payments WHERE currency = 'INR'`,
    ),
  ]);

  const academy = academyRows[0];
  const revenue = revenueRows[0];
  return {
    reportingPeriod: 'last_30_days',
    reportingCurrency: 'INR',
    academy: {
      totalStudents: Number(academy.totalStudents),
      activeStudents: Number(academy.activeStudents),
      activeEnrollments: Number(academy.activeEnrollments),
      activeCourses: Number(academy.activeCourses),
      complaintsLast30Days: Number(academy.complaintsLast30Days),
    },
    courses: courseRows.map((row) => ({
      course: String(row.course),
      activeEnrollments: Number(row.activeEnrollments),
      pendingTasks: Number(row.pendingTasks),
    })),
    lowestRecordedAttendance: lowAttendanceRows.map((row) => ({
      studentCode: String(row.studentCode),
      course: String(row.course),
      attendedClasses: Number(row.attendedClasses),
      recordedClasses: Number(row.recordedClasses),
      attendancePercent: Number(row.attendancePercent),
    })),
    complaints: {
      period: 'last_30_days',
      byStatus: toCountBreakdown(complaintStatusRows),
      byPriority: toCountBreakdown(complaintPriorityRows),
      byCategory: toCountBreakdown(complaintCategoryRows),
    },
    revenueINR: {
      collectedThisMonth: Number(revenue.collectedThisMonth),
      collectedThisQuarter: Number(revenue.collectedThisQuarter),
      collectedThisYear: Number(revenue.collectedThisYear),
      pendingAmount: Number(revenue.pendingINR),
    },
  };
}
