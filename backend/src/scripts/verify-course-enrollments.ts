import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mysql, { type RowDataPacket } from 'mysql2/promise';

dotenv.config();

const apiBase = `http://localhost:${process.env.PORT || '5000'}/api`;
const tests: Array<{ test: string; result: 'PASS' | 'FAIL'; [key: string]: unknown }> = [];
const temporaryStudentIds: Array<number | string> = [];
const studentTokens: string[] = [];
let adminToken: string | undefined;

class TestStopError extends Error {
  constructor(readonly category: string) { super(category); }
}

function record(test: string, passed: boolean, details: Record<string, unknown> = {}) {
  tests.push({ test, result: passed ? 'PASS' : 'FAIL', ...details });
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
  return { status: response.status, data: await response.json().catch(() => ({})) as Record<string, any> };
}

function courseNames(courses: Array<{ name?: string; course?: string }>) {
  return courses.map((course) => course.name ?? course.course ?? '').sort();
}

async function createStudent(token: string, courses: Array<{ id: number | string }>, label: string) {
  const unique = crypto.randomUUID();
  const password = crypto.randomBytes(24).toString('base64url');
  const response = await request('/admin/students', {
    method: 'POST',
    token,
    body: {
      fullName: `Course Enrollment ${label}`,
      email: `course-enrollment-${unique}@example.invalid`,
      phone: `555${crypto.randomInt(1000000, 9999999)}`,
      courseIds: courses.map((course) => course.id),
      batch: `ENR-${unique.slice(0, 8)}`,
      joinDate: new Date().toISOString().slice(0, 10),
      password,
    },
  });
  if (response.data.student?.id) temporaryStudentIds.push(response.data.student.id);
  return { ...response, password };
}

async function loginStudent(studentId: string, password: string) {
  const response = await request('/auth/student/login', {
    method: 'POST',
    body: { studentId, password },
  });
  if (response.data.token) studentTokens.push(response.data.token);
  return response;
}

async function run() {
  let db: mysql.Connection | undefined;
  let stage = 'admin_authentication';
  try {
    const adminLogin = await request('/auth/admin/login', {
      method: 'POST',
      body: { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD },
    });
    adminToken = adminLogin.data.token;
    record('Management authentication', adminLogin.status === 200 && adminLogin.data.user?.role === 'ADMIN', { status: adminLogin.status });
    if (!adminToken) throw new TestStopError('admin_login_failed');

    const coursesResponse = await request('/admin/courses', { token: adminToken });
    const availableCourses = coursesResponse.data.courses ?? [];
    const courseA = availableCourses.find((course: any) => course.name === 'Data Analytics') ?? availableCourses[0];
    const courseASecond = availableCourses.find((course: any) => course.id !== courseA?.id);
    const courseB = availableCourses.find((course: any) => course.id !== courseA?.id && course.id !== courseASecond?.id);
    record('At least three active courses available for isolation test', coursesResponse.status === 200 && Boolean(courseA && courseASecond && courseB), { activeCourseCount: availableCourses.length });
    if (!courseA || !courseASecond || !courseB) throw new TestStopError('active_courses_unavailable');

    stage = 'temporary_student_creation';
    const studentA = await createStudent(adminToken, [courseA, courseASecond], 'Student A');
    const studentB = await createStudent(adminToken, [courseB], 'Student B');
    record('Admin creates two students with selected courses', studentA.status === 201 && studentB.status === 201, { studentACourses: 2, studentBCourses: 1 });
    if (studentA.status !== 201 || studentB.status !== 201) throw new TestStopError('student_creation_failed');

    db = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [identities] = await db.execute<RowDataPacket[]>(
      'SELECT id, user_id AS userId, student_id AS studentId FROM students WHERE id IN (?, ?)',
      [studentA.data.student.id, studentB.data.student.id],
    );
    const identityByRecordId = new Map(identities.map((row) => [Number(row.id), row]));
    const identityA = identityByRecordId.get(Number(studentA.data.student.id));
    const identityB = identityByRecordId.get(Number(studentB.data.student.id));
    if (!identityA || !identityB) throw new TestStopError('student_mysql_identity_missing');

    stage = 'student_authentication';
    const loginA = await loginStudent(identityA.studentId, studentA.password);
    const loginB = await loginStudent(identityB.studentId, studentB.password);
    record('Temporary students can authenticate', loginA.status === 200 && loginB.status === 200, { studentA: loginA.status, studentB: loginB.status });
    if (!loginA.data.token || !loginB.data.token) throw new TestStopError('student_login_failed');

    stage = 'ownership_checks';
    const unauthenticated = await request('/student/courses');
    const adminEndpointAsStudent = await request('/admin/courses', { token: loginA.data.token });
    const responseA = await request(`/student/courses?studentId=${encodeURIComponent(identityB.studentId)}&userId=${encodeURIComponent(identityB.userId)}`, { token: loginA.data.token });
    const responseB = await request(`/student/courses?studentId=${encodeURIComponent(identityA.studentId)}&userId=${encodeURIComponent(identityA.userId)}`, { token: loginB.data.token });
    const namesA = courseNames(responseA.data.courses ?? []);
    const namesB = courseNames(responseB.data.courses ?? []);
    record('Unauthenticated course request is rejected', unauthenticated.status === 401, { status: unauthenticated.status });
    record('Student cannot use admin course-management endpoint', adminEndpointAsStudent.status === 403, { status: adminEndpointAsStudent.status });
    record('Student A receives only A enrollments despite spoofed IDs', responseA.status === 200
      && JSON.stringify(namesA) === JSON.stringify(courseNames([courseA, courseASecond]))
      && !namesA.includes(courseB.name), { courseCount: namesA.length, leakedOtherCourse: namesA.includes(courseB.name) });
    record('Student B receives only B enrollment despite spoofed IDs', responseB.status === 200
      && JSON.stringify(namesB) === JSON.stringify(courseNames([courseB]))
      && !namesB.includes(courseA.name) && !namesB.includes(courseASecond.name), {
      courseCount: namesB.length,
      leakedOtherCourse: namesB.includes(courseA.name) || namesB.includes(courseASecond.name),
    });

    const adminStudents = await request('/admin/students', { token: adminToken });
    const adminA = adminStudents.data.students?.find((student: any) => Number(student.id) === Number(studentA.data.student.id));
    const adminB = adminStudents.data.students?.find((student: any) => Number(student.id) === Number(studentB.data.student.id));
    record('Admin student list returns assigned courses', JSON.stringify(courseNames(adminA?.courses ?? [])) === JSON.stringify(courseNames([courseA, courseASecond]))
      && JSON.stringify(courseNames(adminB?.courses ?? [])) === JSON.stringify(courseNames([courseB])));

    stage = 'mysql_enrollment_verification';
    const [enrollmentRows] = await db!.execute<RowDataPacket[]>(
      `SELECT e.student_id AS studentRecordId, e.course_id AS courseId, e.status, c.title AS course
       FROM enrollments e INNER JOIN courses c ON c.id = e.course_id
       WHERE e.student_id IN (?, ?) AND e.status <> 'dropped' ORDER BY e.student_id, c.title`,
      [studentA.data.student.id, studentB.data.student.id],
    );
    const rowsForA = enrollmentRows.filter((row) => Number(row.studentRecordId) === Number(studentA.data.student.id));
    const rowsForB = enrollmentRows.filter((row) => Number(row.studentRecordId) === Number(studentB.data.student.id));
    record('MySQL enrollment rows match each selected course', courseNames(rowsForA.map((row) => ({ name: String(row.course) }))).join('|') === courseNames([courseA, courseASecond]).join('|')
      && courseNames(rowsForB.map((row) => ({ name: String(row.course) }))).join('|') === courseNames([courseB]).join('|')
      && [...rowsForA, ...rowsForB].every((row) => row.status === 'active'), { studentAEnrollmentRows: rowsForA.length, studentBEnrollmentRows: rowsForB.length });
  } catch (error) {
    record('Course enrollment verification completed', false, { category: error instanceof TestStopError ? error.category : 'runtime_error', stage });
  } finally {
    if (adminToken) {
      for (const studentId of temporaryStudentIds) {
        const result = await request(`/admin/students/${encodeURIComponent(studentId)}/status`, {
          method: 'PATCH',
          token: adminToken,
          body: { status: 'Inactive' },
        }).catch(() => ({ status: 0, data: {} }));
        record('Temporary student deactivated', result.status === 200);
      }
      await request('/auth/logout', { method: 'POST', token: adminToken }).catch(() => undefined);
    }
    for (const token of studentTokens) await request('/auth/logout', { method: 'POST', token }).catch(() => undefined);
    if (db) await db.end().catch(() => undefined);
  }

  const failures = tests.filter((test) => test.result !== 'PASS');
  console.log(JSON.stringify({ tests, allPassed: failures.length === 0, failures: failures.length, temporaryStudentsDeactivated: temporaryStudentIds.length, secretsPrinted: false }, null, 2));
  if (failures.length) process.exitCode = 1;
}

run().catch(() => {
  console.log(JSON.stringify({ fatal: true, secretsPrinted: false }));
  process.exitCode = 1;
});