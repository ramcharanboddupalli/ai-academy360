import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../config/database.js';

export type StudentCourseRecord = {
  id: number | string;
  code: string;
  name: string;
  batch: string;
  status: 'active' | 'completed';
  enrollmentDate: string;
  progress: number | null;
  currentTopic: string | null;
  attendancePercent: number | null;
  instructor: string | null;
  duration: string | null;
};

export async function getStudentProfile(userId: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT s.id, s.student_id AS studentId, s.full_name AS fullName, s.email, s.phone,
            s.batch, DATE_FORMAT(s.join_date, '%Y-%m-%d') AS joinDate, s.status,
            c.id AS courseId, c.title AS course
     FROM students s INNER JOIN courses c ON c.id = s.course_id
     WHERE s.user_id = ? AND s.status = 'Active' LIMIT 1`,
    [userId],
  );
  if (!rows[0]) return null;
  const [courses] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT c.id, c.code, c.title AS name, e.status, e.batch,
            DATE_FORMAT(e.enrolled_at, '%Y-%m-%dT%H:%i:%sZ') AS enrollmentDate
     FROM students s INNER JOIN enrollments e ON e.student_id = s.id
     INNER JOIN courses c ON c.id = e.course_id
     WHERE s.user_id = ? AND s.status = 'Active' AND e.status <> 'dropped'
     ORDER BY c.title`,
    [userId],
  );
  return { ...rows[0], courses };
}

export async function getStudentCourses(userId: number): Promise<StudentCourseRecord[]> {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT c.id, c.code, c.title AS name, e.batch, e.status,
            DATE_FORMAT(e.enrolled_at, '%Y-%m-%dT%H:%i:%sZ') AS enrollmentDate,
            p.progress_percent AS progress, p.current_topic AS currentTopic,
            (SELECT ROUND(SUM(a.status IN ('present', 'late')) * 100 / NULLIF(COUNT(*), 0), 1)
             FROM attendance a INNER JOIN classes cl ON cl.id = a.class_id
             WHERE a.student_id = s.id AND cl.course_id = c.id) AS attendancePercent,
            NULL AS instructor, NULL AS duration
     FROM students s INNER JOIN enrollments e ON e.student_id = s.id
     INNER JOIN courses c ON c.id = e.course_id
     LEFT JOIN course_progress p ON p.enrollment_id = e.id
     WHERE s.user_id = ? AND s.status = 'Active' AND e.status <> 'dropped'
     ORDER BY e.enrolled_at DESC, c.title`,
    [userId],
  );
  return rows.map((row): StudentCourseRecord => ({
    id: row.id,
    code: String(row.code),
    name: String(row.name),
    batch: String(row.batch),
    status: row.status,
    enrollmentDate: String(row.enrollmentDate),
    progress: row.progress === null ? null : Number(row.progress),
    currentTopic: row.currentTopic === null ? null : String(row.currentTopic),
    attendancePercent: row.attendancePercent === null ? null : Number(row.attendancePercent),
    instructor: null,
    duration: null,
  }));
}

export async function getStudentSchedule(userId: number, limit = 100) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT cl.id, c.id AS courseId, c.title AS course, cl.title,
            DATE_FORMAT(cl.starts_at, '%Y-%m-%dT%H:%i:%s') AS startsAt,
            DATE_FORMAT(cl.ends_at, '%Y-%m-%dT%H:%i:%s') AS endsAt,
            cl.instructor, cl.location, cl.status,
            cl.meeting_url AS meetingUrl,
            cl.recording_url AS recordingUrl,
            (cl.recording_url IS NOT NULL AND cl.recording_url <> '') AS recordingAvailable
     FROM students s INNER JOIN enrollments e ON e.student_id = s.id
     INNER JOIN classes cl ON cl.course_id = e.course_id
     INNER JOIN courses c ON c.id = cl.course_id
     WHERE s.user_id = ? AND s.status = 'Active' AND e.status <> 'dropped'
       AND cl.status IN ('scheduled', 'live') AND cl.starts_at >= CURRENT_TIMESTAMP
     ORDER BY cl.starts_at LIMIT ?`,
    [userId, limit],
  );
  return rows;
}

export async function getStudentLearning(userId: number) {
  const [courses, tasks, attendance, resources, completedTopics] = await Promise.all([
    getStudentCourses(userId),
    getDatabasePool().execute<RowDataPacket[]>(
      `SELECT t.id, c.id AS courseId, c.title AS course, t.title,
              t.description, DATE_FORMAT(t.due_at, '%Y-%m-%dT%H:%i:%s') AS dueAt,
              t.status, DATE_FORMAT(t.completed_at, '%Y-%m-%dT%H:%i:%s') AS completedAt
       FROM learning_tasks t INNER JOIN students s ON s.id = t.student_id
       INNER JOIN enrollments e ON e.student_id = s.id AND e.course_id = t.course_id
       INNER JOIN courses c ON c.id = t.course_id
       WHERE s.user_id = ? AND s.status = 'Active' AND e.status <> 'dropped'
       ORDER BY t.due_at IS NULL, t.due_at, t.id`,
      [userId],
    ),
    getDatabasePool().execute<RowDataPacket[]>(
      `SELECT c.id AS courseId, c.title AS course, COUNT(a.id) AS recordedClasses,
              SUM(a.status IN ('present', 'late')) AS attendedClasses,
              ROUND(SUM(a.status IN ('present', 'late')) * 100 / NULLIF(COUNT(a.id), 0), 1) AS attendancePercent
       FROM students s INNER JOIN enrollments e ON e.student_id = s.id AND e.status <> 'dropped'
       INNER JOIN courses c ON c.id = e.course_id
       INNER JOIN classes cl ON cl.course_id = c.id
       INNER JOIN attendance a ON a.class_id = cl.id AND a.student_id = s.id
       WHERE s.user_id = ? AND s.status = 'Active'
       GROUP BY c.id, c.title ORDER BY c.title`,
      [userId],
    ),
    getDatabasePool().execute<RowDataPacket[]>(
      `SELECT r.id, c.id AS courseId, c.title AS course, r.title,
              r.description, r.resource_type AS resourceType, r.resource_url AS resourceUrl,
              DATE_FORMAT(r.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
       FROM students s INNER JOIN enrollments e ON e.student_id = s.id AND e.status <> 'dropped'
       INNER JOIN courses c ON c.id = e.course_id
       INNER JOIN resources r ON r.course_id = c.id AND r.is_active = TRUE
       WHERE s.user_id = ? AND s.status = 'Active' ORDER BY c.title, r.created_at DESC`,
      [userId],
    ),
    getDatabasePool().execute<RowDataPacket[]>(
      `SELECT t.id, c.id AS courseId, c.title AS course, t.title,
              DATE_FORMAT(stc.completed_at, '%Y-%m-%dT%H:%i:%sZ') AS completedAt
       FROM students s INNER JOIN student_topic_completions stc ON stc.student_id = s.id
       INNER JOIN course_topics t ON t.id = stc.topic_id AND t.is_active = TRUE
       INNER JOIN enrollments e ON e.student_id = s.id AND e.course_id = t.course_id AND e.status <> 'dropped'
       INNER JOIN courses c ON c.id = t.course_id
       WHERE s.user_id = ? AND s.status = 'Active' ORDER BY stc.completed_at DESC`,
      [userId],
    ),
  ]);

  const taskRows = tasks[0];
  const attendanceRows = attendance[0];
  const resourceRows = resources[0];
  const completedRows = completedTopics[0];
  const progressValues = courses.map((course) => course.progress).filter((value): value is number => value !== null);
  const attendanceClasses = attendanceRows.reduce((sum, row) => sum + Number(row.recordedClasses), 0);
  const attendedClasses = attendanceRows.reduce((sum, row) => sum + Number(row.attendedClasses), 0);
  return {
    courses,
    tasks: taskRows,
    attendance: attendanceRows.map((row) => ({
      courseId: row.courseId,
      course: String(row.course),
      recordedClasses: Number(row.recordedClasses),
      attendedClasses: Number(row.attendedClasses),
      attendancePercent: Number(row.attendancePercent),
    })),
    resources: resourceRows,
    completedTopics: completedRows,
    overallProgress: progressValues.length ? Number((progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length).toFixed(1)) : null,
    attendancePercent: attendanceClasses ? Number((attendedClasses * 100 / attendanceClasses).toFixed(1)) : null,
    pendingTasks: taskRows.filter((task) => task.status !== 'completed').length,
    hasActivity: progressValues.length > 0 || taskRows.length > 0 || attendanceClasses > 0 || completedRows.length > 0,
  };
}

export async function getStudentPayments(userId: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT p.id, c.title AS course, p.amount, p.currency,
            DATE_FORMAT(p.payment_date, '%Y-%m-%dT%H:%i:%s') AS paymentDate,
            DATE_FORMAT(p.due_date, '%Y-%m-%d') AS dueDate,
            p.payment_method AS paymentMethod,
            p.status, p.reference_id AS referenceId, p.receipt_url AS receiptUrl
     FROM students s INNER JOIN payments p ON p.student_id = s.id
     LEFT JOIN enrollments e ON e.id = p.enrollment_id AND e.student_id = s.id AND e.status <> 'dropped'
     LEFT JOIN courses c ON c.id = e.course_id
     WHERE s.user_id = ? AND s.status = 'Active'
     ORDER BY p.payment_date DESC, p.id DESC`,
    [userId],
  );
  const payments: Array<RowDataPacket & { amount: number; currency: string; status: string }> = rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
    currency: String(row.currency),
    status: String(row.status),
  }));
  const totalsByCurrency = payments.reduce<Record<string, { total: number; paid: number; pending: number }>>((totals, payment) => {
    const currency = String(payment.currency);
    totals[currency] ??= { total: 0, paid: 0, pending: 0 };
    totals[currency].total += payment.amount;
    if (payment.status === 'paid') totals[currency].paid += payment.amount;
    if (payment.status === 'pending') totals[currency].pending += payment.amount;
    return totals;
  }, {});
  return { payments, totalsByCurrency };
}

export async function getStudentCertificates(userId: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT cert.id, COALESCE(cert.title, c.title) AS title, c.title AS course, cert.certificate_id AS certificateId,
            cert.status, DATE_FORMAT(cert.issued_at, '%Y-%m-%d') AS issueDate,
            cert.file_url AS fileUrl
     FROM students s INNER JOIN certificates cert ON cert.student_id = s.id
     INNER JOIN courses c ON c.id = cert.course_id
     WHERE s.user_id = ? AND s.status = 'Active'
     ORDER BY cert.issued_at DESC, cert.id DESC`,
    [userId],
  );
  return rows;
}

export async function getStudentInternships(userId: number) {
  const [opportunities] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT i.id, i.title, i.organization, i.description, i.duration,
            i.requirements, i.skill_requirements AS skillRequirements,
            i.location, i.work_mode AS workMode, i.stipend_amount AS stipendAmount,
            i.stipend_currency AS stipendCurrency, i.eligibility, i.application_url AS applicationUrl,
            DATE_FORMAT(i.application_deadline, '%Y-%m-%dT%H:%i:%s') AS applicationDeadline
     FROM internships i
     WHERE i.is_published = TRUE AND (i.application_deadline IS NULL OR i.application_deadline >= CURRENT_TIMESTAMP)
       AND NOT EXISTS (
         SELECT 1 FROM internship_applications a INNER JOIN students s ON s.id = a.student_id
         WHERE s.user_id = ? AND s.status = 'Active' AND a.internship_id = i.id
       )
     ORDER BY i.application_deadline, i.title`,
    [userId],
  );
  const [applications] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT a.id, i.id AS internshipId, i.title, i.organization, i.duration, a.status, a.admin_note AS adminNote,
            DATE_FORMAT(a.applied_at, '%Y-%m-%dT%H:%i:%sZ') AS appliedAt,
            DATE_FORMAT(a.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
     FROM students s INNER JOIN internship_applications a ON a.student_id = s.id
     INNER JOIN internships i ON i.id = a.internship_id
     WHERE s.user_id = ? AND s.status = 'Active'
     ORDER BY a.updated_at DESC`,
    [userId],
  );
  return { opportunities, applications };
}

export async function getStudentAnnouncements(userId: number, limit = 100) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT a.id, a.title, a.message, a.category,
            DATE_FORMAT(COALESCE(a.published_at, a.created_at), '%Y-%m-%dT%H:%i:%sZ') AS publishedAt,
            (r.announcement_id IS NOT NULL) AS isRead
     FROM students s
     INNER JOIN announcements a ON a.is_published = TRUE
     LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.student_id = s.id
     WHERE s.user_id = ? AND s.status = 'Active'
       AND (a.scheduled_at IS NULL OR a.scheduled_at <= CURRENT_TIMESTAMP)
       AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
       AND (a.target_type = 'all'
         OR (a.target_type = 'student' AND a.target_student_id = s.id)
         OR (a.target_type = 'course' AND EXISTS (
           SELECT 1 FROM enrollments e WHERE e.student_id = s.id
             AND e.course_id = a.target_course_id AND e.status <> 'dropped'
         )))
     ORDER BY COALESCE(a.published_at, a.created_at) DESC, a.id DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map((row) => ({ ...row, isRead: Boolean(row.isRead) }));
}

export async function markStudentAnnouncementRead(userId: number, announcementId: number) {
  const [visible] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT a.id FROM students s INNER JOIN announcements a ON a.id = ? AND a.is_published = TRUE
     WHERE s.user_id = ? AND s.status = 'Active'
       AND (a.scheduled_at IS NULL OR a.scheduled_at <= CURRENT_TIMESTAMP)
       AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
       AND (a.target_type = 'all'
         OR (a.target_type = 'student' AND a.target_student_id = s.id)
         OR (a.target_type = 'course' AND EXISTS (
           SELECT 1 FROM enrollments e WHERE e.student_id = s.id
             AND e.course_id = a.target_course_id AND e.status <> 'dropped'
         ))) LIMIT 1`,
    [announcementId, userId],
  );
  if (!visible[0]) return false;
  await getDatabasePool().execute(
    `INSERT INTO announcement_reads (announcement_id, student_id) 
     SELECT ?, s.id FROM students s WHERE s.user_id = ? AND s.status = 'Active'
     ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP`,
    [announcementId, userId],
  );
  return true;
}

export async function getStudentSupportSummary(userId: number) {
  const [rows] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT COUNT(*) AS totalTickets,
            COALESCE(SUM(t.status NOT IN ('resolved', 'closed')), 0) AS activeTickets
     FROM students s LEFT JOIN tickets t ON t.student_id = s.id
     WHERE s.user_id = ? AND s.status = 'Active'`,
    [userId],
  );
  const [tickets] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT CONCAT('TKT-', LPAD(t.id, 6, '0')) AS ticketNumber, t.title, t.status,
            DATE_FORMAT(t.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
     FROM students s INNER JOIN tickets t ON t.student_id = s.id
     WHERE s.user_id = ? AND s.status = 'Active'
     ORDER BY t.updated_at DESC LIMIT 3`,
    [userId],
  );
  return {
    totalTickets: Number(rows[0].totalTickets),
    activeTickets: Number(rows[0].activeTickets),
    recentTickets: tickets,
  };
}

export async function getStudentDashboard(userId: number) {
  const profile = await getStudentProfile(userId);
  if (!profile) return null;
  const [learning, schedule, announcements, support] = await Promise.all([
    getStudentLearning(userId),
    getStudentSchedule(userId, 5),
    getStudentAnnouncements(userId, 5),
    getStudentSupportSummary(userId),
  ]);
  return {
    student: profile,
    activeCourseCount: learning.courses.filter((course) => course.status === 'active').length,
    overallProgress: learning.overallProgress,
    attendancePercent: learning.attendancePercent,
    pendingTasks: learning.pendingTasks,
    courses: learning.courses,
    todayAndUpcomingClasses: schedule,
    recentAnnouncements: announcements,
    support,
    learningActivityAvailable: learning.hasActivity,
  };
}