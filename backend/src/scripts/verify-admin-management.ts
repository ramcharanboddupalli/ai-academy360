import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mysql, { type RowDataPacket } from 'mysql2/promise';

dotenv.config();

const apiBase = `http://localhost:${process.env.PORT || '5000'}/api`;
const nonce = crypto.randomUUID();
const results: Array<{ test: string; result: 'PASS' | 'FAIL'; [key: string]: unknown }> = [];
let db: mysql.Connection | undefined;
let adminToken: string | undefined;
let studentToken: string | undefined;
let temporaryPassword: string | undefined;
let studentRecordId: number | undefined;
let testCourseId: number | undefined;
let classId: number | undefined;
let resourceId: number | undefined;
let taskId: number | undefined;
let paymentId: number | undefined;
let certificateId: number | undefined;
let internshipId: number | undefined;
let announcementId: number | undefined;

function record(test: string, passed: boolean, details: Record<string, unknown> = {}) {
  results.push({ test, result: passed ? 'PASS' : 'FAIL', ...details });
}

async function request(path: string, options: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await response.json().catch(() => ({})) as Record<string, any>;
  return { status: response.status, data };
}

async function cleanup() {
  if (!db) return;
  if (announcementId) {
    await db.execute('DELETE FROM announcement_reads WHERE announcement_id = ?', [announcementId]);
    await db.execute('DELETE FROM announcements WHERE id = ?', [announcementId]);
  }
  if (certificateId) await db.execute('DELETE FROM certificates WHERE id = ?', [certificateId]);
  if (paymentId) await db.execute('DELETE FROM payments WHERE id = ?', [paymentId]);
  if (classId) {
    await db.execute('DELETE FROM attendance WHERE class_id = ?', [classId]);
    await db.execute('DELETE FROM classes WHERE id = ?', [classId]);
  }
  if (taskId) await db.execute('DELETE FROM learning_tasks WHERE id = ?', [taskId]);
  if (resourceId) await db.execute('DELETE FROM resources WHERE id = ?', [resourceId]);
  if (internshipId) await db.execute('DELETE FROM internships WHERE id = ?', [internshipId]);
  if (studentRecordId) {
    await db.execute('DELETE FROM course_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = ?)', [studentRecordId]);
    await db.execute('DELETE FROM enrollments WHERE student_id = ?', [studentRecordId]);
    const [users] = await db.execute<RowDataPacket[]>('SELECT user_id AS userId FROM students WHERE id = ?', [studentRecordId]);
    await db.execute('DELETE FROM students WHERE id = ?', [studentRecordId]);
    if (users[0]) await db.execute('DELETE FROM users WHERE id = ?', [users[0].userId]);
  }
  if (testCourseId) await db.execute('DELETE FROM courses WHERE id = ?', [testCourseId]);
}

async function run() {
  try {
    const health = await request('/health');
    const dbHealth = await request('/health/db');
    record('API and MySQL available', health.status === 200 && dbHealth.status === 200 && dbHealth.data.database === 'connected');
    const login = await request('/auth/admin/login', { method: 'POST', body: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD } });
    adminToken = login.data.token;
    record('Admin session authenticated', login.status === 200 && Boolean(adminToken));
    if (!adminToken) throw new Error('admin_authentication_failed');

    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const noAuth = await request('/admin/management/courses');
    record('Admin management requires authentication (401)', noAuth.status === 401, { status: noAuth.status });
    const courseResponse = await request('/admin/courses', { token: adminToken });
    const baseCourse = courseResponse.data.courses?.[0];
    if (!baseCourse) throw new Error('active_course_unavailable');
    const courseCreated = await request('/admin/management/courses', {
      method: 'POST',
      token: adminToken,
      body: { code: `QA-${nonce.slice(0, 8)}`, title: `Admin Management QA ${nonce.slice(0, 8)}`, description: 'Temporary cross-portal verification course', instructor: 'QA' },
    });
    testCourseId = Number(courseCreated.data.courseId) || undefined;
    record('Admin created a MySQL course', courseCreated.status === 201 && Boolean(testCourseId));
    if (!testCourseId) throw new Error('course_creation_failed');
    const [[courseRows]] = await db.execute<RowDataPacket[]>('SELECT id FROM courses WHERE id = ? AND code = ?', [testCourseId, `QA-${nonce.slice(0, 8)}`]);
    record('Created course persisted to MySQL', Boolean(courseRows));

    temporaryPassword = crypto.randomBytes(24).toString('base64url');
    const studentResponse = await request('/admin/students', {
      method: 'POST',
      token: adminToken,
      body: {
        fullName: `Admin Management QA ${nonce.slice(0, 8)}`,
        email: `admin-management-${nonce}@example.invalid`,
        phone: '5550100789',
        courseId: baseCourse.id,
        batch: `QA-${nonce.slice(0, 8)}`,
        joinDate: new Date().toISOString().slice(0, 10),
        password: temporaryPassword,
      },
    });
    studentRecordId = Number(studentResponse.data.student?.id) || undefined;
    record('Temporary test student created via admin API', studentResponse.status === 201 && Boolean(studentRecordId));
    if (!studentRecordId) throw new Error('student_creation_failed');
    const studentLogin = await request('/auth/student/login', { method: 'POST', body: { studentId: studentResponse.data.student.studentId, password: temporaryPassword } });
    studentToken = studentLogin.data.token;
    record('Temporary test student can authenticate', studentLogin.status === 200 && Boolean(studentToken));
    if (!studentToken) throw new Error('student_authentication_failed');
    const studentAdminAccess = await request('/admin/management/learning', { token: studentToken });
    record('Student access to admin management denied (403)', studentAdminAccess.status === 403, { status: studentAdminAccess.status });

    const assigned = await request(`/admin/management/courses/${testCourseId}/students`, { method: 'POST', token: adminToken, body: { studentId: studentRecordId } });
    const enrolledCourses = await request('/student/courses', { token: studentToken });
    record('Admin assigned course and student sees it', assigned.status === 201 && enrolledCourses.data.courses?.some((item: { id: number | string }) => Number(item.id) === testCourseId));

    const startsAt = '2099-10-03T10:00:00';
    const endsAt = '2099-10-03T11:00:00';
    const classCreated = await request('/admin/management/classes', {
      method: 'POST', token: adminToken,
      body: { courseId: testCourseId, title: 'QA Scheduled Class', startsAt, endsAt, instructor: 'QA Instructor', location: 'Online', meetingUrl: 'https://example.invalid/meet', recordingUrl: '', status: 'scheduled' },
    });
    classId = Number(classCreated.data.id) || undefined;
    const schedule = await request('/student/schedule', { token: studentToken });
    record('Admin scheduled class appears in enrolled student schedule', classCreated.status === 201 && schedule.data.classes?.some((item: { id: number | string }) => Number(item.id) === classId));

    const resourceCreated = await request('/admin/management/resources', {
      method: 'POST', token: adminToken,
      body: { courseId: testCourseId, title: `QA Resource ${nonce.slice(0, 8)}`, description: 'Temporary resource', resourceType: 'link', resourceUrl: 'https://example.invalid/resource' },
    });
    resourceId = Number(resourceCreated.data.id) || undefined;
    const taskCreated = await request('/admin/management/tasks', {
      method: 'POST', token: adminToken,
      body: { courseId: testCourseId, studentId: studentRecordId, title: `QA Task ${nonce.slice(0, 8)}`, description: 'Temporary task', dueAt: '2099-10-04T12:00' },
    });
    const [[taskRows]] = await db.execute<RowDataPacket[]>('SELECT id FROM learning_tasks WHERE student_id = ? AND course_id = ? AND title = ?', [studentRecordId, testCourseId, `QA Task ${nonce.slice(0, 8)}`]);
    taskId = Number(taskRows?.id) || undefined;
    await request('/admin/management/progress', { method: 'PUT', token: adminToken, body: { studentId: studentRecordId, courseId: testCourseId, progress: 63.5, currentTopic: 'QA topic' } });
    const enrollments = await request('/admin/management/enrollments', { token: adminToken });
    const enrollment = enrollments.data.enrollments?.find((item: { studentId: number | string; courseId: number | string }) => Number(item.studentId) === studentRecordId && Number(item.courseId) === testCourseId);
    const [[progressRows]] = await db.execute<RowDataPacket[]>('SELECT id FROM course_progress WHERE enrollment_id = ?', [enrollment?.id]);
    record('Resource, task, and progress saved by admin APIs to MySQL', resourceCreated.status === 201 && taskCreated.status === 201 && Boolean(resourceId && taskId && progressRows));
    const learning = await request('/student/learning', { token: studentToken });
    record('Student Learning shows admin resource, task, and progress', learning.status === 200
      && learning.data.learning.resources?.some((item: { id: number | string }) => Number(item.id) === resourceId)
      && learning.data.learning.tasks?.some((item: { id: number | string }) => Number(item.id) === taskId)
      && learning.data.learning.courses?.some((item: { id: number | string; progress: number | null }) => Number(item.id) === testCourseId && item.progress === 63.5));

    const attendance = await request(`/admin/management/classes/${classId}/attendance`, { token: adminToken });
    const attendanceSave = await request(`/admin/management/classes/${classId}/attendance`, {
      method: 'PUT', token: adminToken,
      body: { attendance: [{ studentId: studentRecordId, status: 'present' }] },
    });
    const learningAfterAttendance = await request('/student/learning', { token: studentToken });
    record('Admin attendance appears in student learning', attendance.status === 200 && attendance.data.students?.some((item: { studentId: number | string }) => Number(item.studentId) === studentRecordId)
      && attendanceSave.status === 200 && learningAfterAttendance.data.learning.attendance?.some((item: { courseId: number | string; attendedClasses: number }) => Number(item.courseId) === testCourseId && item.attendedClasses === 1));

    const paymentCreated = await request('/admin/management/payments', {
      method: 'POST', token: adminToken,
      body: { studentId: studentRecordId, enrollmentId: enrollment.id, amount: 1250.5, paymentMethod: 'upi', paymentDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10), status: 'paid', referenceId: `QA-${nonce.slice(0, 8)}`, receiptUrl: '' },
    });
    paymentId = Number(paymentCreated.data.id) || undefined;
    const studentPayments = await request('/student/payments', { token: studentToken });
    record('INR payment appears in student payment history', paymentCreated.status === 201 && studentPayments.data.payments?.some((item: { id: number | string; amount: number; currency: string }) => Number(item.id) === paymentId && Number(item.amount) === 1250.5 && item.currency === 'INR'));

    const certificateCreated = await request('/admin/management/certificates', {
      method: 'POST', token: adminToken,
      body: { studentId: studentRecordId, courseId: testCourseId, certificateId: `QA-CERT-${nonce.slice(0, 8)}`, issueDate: new Date().toISOString().slice(0, 10), fileUrl: 'https://example.invalid/certificate' },
    });
    certificateId = Number(certificateCreated.data.id) || undefined;
    const studentCertificates = await request('/student/certificates', { token: studentToken });
    record('Issued certificate appears in student portal', certificateCreated.status === 201 && studentCertificates.data.certificates?.some((item: { id: number | string }) => Number(item.id) === certificateId));

    const internshipCreated = await request('/admin/management/internships', {
      method: 'POST', token: adminToken,
      body: { title: `QA Internship ${nonce.slice(0, 8)}`, organization: 'QA Organization', description: 'Temporary opportunity', duration: '3 months', requirements: ['Course enrollment'], skillRequirements: ['TypeScript'], location: 'India', workMode: 'Remote', stipendAmount: 25000, eligibility: 'QA verification', applicationUrl: 'https://example.invalid/apply', applicationDeadline: '2099-10-30T23:59', isPublished: true },
    });
    internshipId = Number(internshipCreated.data.id) || undefined;
    const studentInternships = await request('/student/internships', { token: studentToken });
    record('Published internship appears in student portal with INR stipend', internshipCreated.status === 201 && studentInternships.data.opportunities?.some((item: { id: number | string; stipendCurrency: string }) => Number(item.id) === internshipId && item.stipendCurrency === 'INR'));

    const announcementCreated = await request('/admin/management/announcements', {
      method: 'POST', token: adminToken,
      body: { title: `QA Announcement ${nonce.slice(0, 8)}`, message: 'Temporary targeted announcement', category: 'general', targetType: 'student', targetStudentId: studentRecordId, isPublished: true, scheduledAt: null, expiresAt: null },
    });
    announcementId = Number(announcementCreated.data.id) || undefined;
    const studentAnnouncements = await request('/student/announcements', { token: studentToken });
    record('Published targeted announcement appears in student portal', announcementCreated.status === 201 && studentAnnouncements.data.announcements?.some((item: { id: number | string }) => Number(item.id) === announcementId));

    const [[persistence]] = await db.execute<RowDataPacket[]>(
      `SELECT (SELECT COUNT(*) FROM classes WHERE id = ?) AS classRows,
              (SELECT COUNT(*) FROM resources WHERE id = ?) AS resourceRows,
              (SELECT COUNT(*) FROM learning_tasks WHERE id = ?) AS taskRows,
              (SELECT COUNT(*) FROM payments WHERE id = ? AND currency = 'INR') AS paymentRows,
              (SELECT COUNT(*) FROM certificates WHERE id = ?) AS certificateRows,
              (SELECT COUNT(*) FROM internships WHERE id = ? AND is_published = TRUE) AS internshipRows,
              (SELECT COUNT(*) FROM announcements WHERE id = ? AND is_published = TRUE) AS announcementRows`,
      [classId ?? 0, resourceId ?? 0, taskId ?? 0, paymentId ?? 0, certificateId ?? 0, internshipId ?? 0, announcementId ?? 0],
    );
    record('All admin-managed records confirmed persisted in MySQL', Object.values(persistence).every((value) => Number(value) === 1));
    const student360 = await request(`/admin/students/${studentRecordId}/360`, { token: adminToken });
    const student360Sections = student360.status === 200
      && Array.isArray(student360.data.courses) && student360.data.payments?.some((item: { id: number | string }) => Number(item.id) === paymentId)
      && student360.data.certificates?.some((item: { id: number | string }) => Number(item.id) === certificateId)
      && Array.isArray(student360.data.internships) && Array.isArray(student360.data.recentActivity);
    record('Student 360 returns courses, payments, certificates, internships, and activity sections', student360Sections, { status: student360.status });
  } catch (error) {
    record('Admin management verification completed without runtime error', false, {
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  } finally {
    if (db) {
      try {
        await cleanup();
      } catch {
        record('Temporary verification data cleanup', false);
      }
      await db.end();
    }
    console.log(JSON.stringify({ tests: results, allPassed: results.every((result) => result.result === 'PASS'), failures: results.filter((result) => result.result === 'FAIL').length, secretsPrinted: false }, null, 2));
    process.exitCode = results.some((result) => result.result === 'FAIL') ? 1 : 0;
  }
}

void run();
