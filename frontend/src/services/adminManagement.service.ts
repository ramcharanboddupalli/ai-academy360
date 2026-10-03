import api from './api';
import type { AdminStudent } from './admin.service';

export type ManagedCourse = {
  id: number | string;
  code: string;
  title: string;
  description: string | null;
  instructor: string | null;
  isActive: boolean;
  enrollmentCount: number;
};

export type ManagedStudent = {
  id: number | string;
  studentId: string;
  fullName: string;
  email?: string;
};

export type ManagedResource = {
  id: number | string;
  courseId: number | string;
  course: string;
  title: string;
  description: string | null;
  resourceType: 'note' | 'pdf' | 'video' | 'link' | 'assignment';
  resourceUrl: string | null;
  isActive: boolean;
};

export type ManagedTask = {
  id: number | string;
  studentId: number | string;
  studentName: string;
  courseId: number | string;
  course: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt: string | null;
};

export type ManagedProgress = {
  studentId: number | string;
  studentCode: string;
  studentName: string;
  enrollmentId: number | string;
  courseId: number | string;
  course: string;
  progress: number | null;
  currentTopic: string | null;
};

export type ManagedClass = {
  id: number | string;
  courseId: number | string;
  course: string;
  title: string;
  startsAt: string;
  endsAt: string;
  instructor: string | null;
  location: string | null;
  meetingUrl: string | null;
  recordingUrl: string | null;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
};

export type ManagedCertificate = {
  id: number | string;
  studentId: number | string;
  studentCode: string;
  studentName: string;
  courseId: number | string;
  course: string;
  title: string;
  certificateId: string;
  status: 'pending' | 'issued' | 'revoked';
  issueDate: string | null;
  fileUrl: string | null;
};

export type ManagedInternshipApplication = {
  id: number | string;
  internshipId: number | string;
  studentId: number | string;
  status: 'applied' | 'under_review' | 'shortlisted' | 'in_progress' | 'completed' | 'rejected' | 'selected' | 'withdrawn';
  adminNote: string | null;
  appliedAt: string;
  updatedAt: string;
  internshipTitle: string;
  organization: string;
  location: string | null;
  workMode: string | null;
  applicationDeadline: string | null;
  studentName: string;
  studentCode: string;
  studentEmail: string;
};

export type ManagedInternship = {
  id: number | string;
  title: string;
  organization: string;
  description: string | null;
  duration: string | null;
  requirements: unknown;
  skillRequirements: unknown;
  location: string | null;
  workMode: string | null;
  stipendAmount: number | null;
  stipendCurrency: string;
  eligibility: string | null;
  applicationUrl: string | null;
  applicationDeadline: string | null;
  isPublished: boolean;
};

export type ManagedAnnouncement = {
  id: number | string;
  title: string;
  message: string;
  category: 'general' | 'course' | 'schedule' | 'payment' | 'internship' | 'important';
  targetType: 'all' | 'course' | 'student';
  targetCourseId: number | string | null;
  targetCourse: string | null;
  targetStudentId: number | string | null;
  targetStudent: string | null;
  isPublished: boolean;
  scheduledAt: string | null;
  expiresAt: string | null;
  publishedAt: string | null;
  readCount: number;
};

export type ManagedPayment = {
  id: number | string;
  studentId: number | string;
  studentCode: string;
  studentName: string;
  enrollmentId: number | string | null;
  course: string | null;
  amount: number;
  currency: string;
  paymentMethod: 'upi' | 'bank_transfer' | 'cash' | 'card' | 'other' | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentDate: string | null;
  dueDate: string | null;
  referenceId: string | null;
  receiptUrl: string | null;
};

export const adminManagementService = {
  student360(id: number | string) {
    return api.get<{
      success: true;
      student: AdminStudent & { status: string };
      courses: Array<{ id: number | string; name: string; status: string }>;
      progress: Array<{ course: string; progress: number | null; currentTopic: string | null; updatedAt: string | null }>;
      attendance: Array<{ course: string; recordedClasses: number; attendedClasses: number; attendancePercent: number | null }>;
      payments: Array<{ id: number | string; course: string | null; amount: number; currency: string; status: string; referenceId: string | null }>;
      certificates: Array<{ id: number | string; course: string; certificateId: string; status: string; fileUrl: string | null }>;
      internships: Array<{ title: string; organization: string; status: string }>;
      tickets: Array<{ ticketNumber: string; title: string; status: string; priority: string; category: string | null; department: string | null }>;
      recentActivity: Array<{ activity: string; occurredAt: string }>;
    }>(`/admin/students/${id}/360`);
  },
  courses() {
    return api.get<{ success: true; courses: ManagedCourse[] }>('/admin/management/courses');
  },
  createCourse(payload: Pick<ManagedCourse, 'code' | 'title' | 'description' | 'instructor'>) {
    return api.post('/admin/management/courses', payload);
  },
  updateCourse(id: number | string, payload: Pick<ManagedCourse, 'code' | 'title' | 'description' | 'instructor'>) {
    return api.put(`/admin/management/courses/${id}`, payload);
  },
  setCourseActive(id: number | string, isActive: boolean) {
    return api.patch(`/admin/management/courses/${id}/status`, { isActive });
  },
  courseStudents(id: number | string) {
    return api.get<{ success: true; students: Array<ManagedStudent & { enrollmentStatus: string; batch: string; enrollmentDate: string }> }>(`/admin/management/courses/${id}/students`);
  },
  assignStudent(courseId: number | string, studentId: number | string) {
    return api.post(`/admin/management/courses/${courseId}/students`, { studentId });
  },
  removeStudent(courseId: number | string, studentId: number | string) {
    return api.delete(`/admin/management/courses/${courseId}/students/${studentId}`);
  },
  learning(courseId?: number | string) {
    return api.get<{ success: true; resources: ManagedResource[]; tasks: ManagedTask[]; progress: ManagedProgress[]; students: Array<ManagedStudent & { courseId: number | string }> }>('/admin/management/learning', { params: courseId ? { courseId } : {} });
  },
  createResource(payload: { courseId: number | string; title: string; description: string; resourceType: ManagedResource['resourceType']; resourceUrl: string }) {
    return api.post('/admin/management/resources', payload);
  },
  updateResource(id: number | string, payload: { courseId: number | string; title: string; description: string; resourceType: ManagedResource['resourceType']; resourceUrl: string; isActive: boolean }) {
    return api.put(`/admin/management/resources/${id}`, payload);
  },
  createTask(payload: { courseId: number | string; studentId?: number | string; title: string; description: string; dueAt: string | null }) {
    return api.post<{ success: true; assignedCount: number }>('/admin/management/tasks', payload);
  },
  updateTask(id: number | string, payload: { title: string; description: string; dueAt: string | null; status: ManagedTask['status'] }) {
    return api.put(`/admin/management/tasks/${id}`, payload);
  },
  updateProgress(payload: { studentId: number | string; courseId: number | string; progress: number; currentTopic: string }) {
    return api.put('/admin/management/progress', payload);
  },
  classes(courseId?: number | string) {
    return api.get<{ success: true; classes: ManagedClass[] }>('/admin/management/classes', { params: courseId ? { courseId } : {} });
  },
  createClass(payload: Omit<ManagedClass, 'id' | 'course'>) {
    return api.post('/admin/management/classes', payload);
  },
  updateClass(id: number | string, payload: Omit<ManagedClass, 'id' | 'course'>) {
    return api.put(`/admin/management/classes/${id}`, payload);
  },
  attendanceRoster(id: number | string) {
    return api.get<{ success: true; students: Array<{ studentId: number | string; studentCode: string; fullName: string; attendanceStatus: string | null }> }>(`/admin/management/classes/${id}/attendance`);
  },
  saveAttendance(id: number | string, attendance: Array<{ studentId: number | string; status: 'present' | 'absent' | 'late' | 'excused' }>) {
    return api.put(`/admin/management/classes/${id}/attendance`, { attendance });
  },
  payments(filters: { studentId?: number | string; period?: 'today' | 'month' | 'quarter' | 'year' | 'custom'; startDate?: string; endDate?: string } = {}) {
    return api.get<{ success: true; payments: ManagedPayment[]; revenue: Record<string, number | string>; period: string }>('/admin/management/payments', { params: filters });
  },
  enrollments() {
    return api.get<{ success: true; enrollments: Array<{ id: number | string; studentId: number | string; studentName: string; courseId: number | string; course: string; batch: string }> }>('/admin/management/enrollments');
  },
  createPayment(payload: { studentId: number | string; enrollmentId: number | string | null; amount: number; paymentMethod: NonNullable<ManagedPayment['paymentMethod']>; paymentDate: string | null; dueDate: string | null; status: ManagedPayment['status']; referenceId: string; receiptUrl: string }) {
    return api.post('/admin/management/payments', payload);
  },
  updatePayment(id: number | string, payload: { studentId: number | string; enrollmentId: number | string | null; amount: number; paymentMethod: NonNullable<ManagedPayment['paymentMethod']>; paymentDate: string | null; dueDate: string | null; status: ManagedPayment['status']; referenceId: string; receiptUrl: string }) {
    return api.put(`/admin/management/payments/${id}`, payload);
  },
  certificates() {
    return api.get<{ success: true; certificates: ManagedCertificate[] }>('/admin/management/certificates');
  },
  issueCertificate(payload: { studentId: number | string; courseId: number | string; title: string; certificateId: string; issueDate: string; fileUrl: string }) {
    return api.post('/admin/management/certificates', payload);
  },
  setCertificateStatus(id: number | string, status: ManagedCertificate['status']) {
    return api.patch(`/admin/management/certificates/${id}/status`, { status });
  },
  internships() {
    return api.get<{ success: true; internships: ManagedInternship[] }>('/admin/management/internships');
  },
  createInternship(payload: Omit<ManagedInternship, 'id' | 'stipendCurrency'>) {
    return api.post('/admin/management/internships', payload);
  },
  updateInternship(id: number | string, payload: Omit<ManagedInternship, 'id' | 'stipendCurrency'>) {
    return api.put(`/admin/management/internships/${id}`, payload);
  },
  internshipApplications(filters: { status?: string; search?: string } = {}) {
    return api.get<{ success: true; applications: ManagedInternshipApplication[] }>('/admin/management/internship-applications', { params: filters });
  },
  updateInternshipApplication(id: number | string, payload: { status: ManagedInternshipApplication['status']; adminNote: string }) {
    return api.patch(`/admin/management/internship-applications/${id}`, payload);
  },
  announcements() {
    return api.get<{ success: true; announcements: ManagedAnnouncement[] }>('/admin/management/announcements');
  },
  createAnnouncement(payload: Omit<ManagedAnnouncement, 'id' | 'targetCourse' | 'targetStudent' | 'publishedAt' | 'readCount'>) {
    return api.post('/admin/management/announcements', payload);
  },
  updateAnnouncement(id: number | string, payload: Omit<ManagedAnnouncement, 'id' | 'targetCourse' | 'targetStudent' | 'publishedAt' | 'readCount'>) {
    return api.put(`/admin/management/announcements/${id}`, payload);
  },
  deleteAnnouncement(id: number | string) {
    return api.delete(`/admin/management/announcements/${id}`);
  },
};
