import api from './api';

export type AdminCourse = { id: number | string; code: string; name: string };

export type AdminStudent = {
  id: number | string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  courseId: number | string;
  course: string;
  courses: AdminCourse[];
  batch: string;
  joinDate: string;
  status: 'Active' | 'Inactive';
};

export type StudentPayload = {
  fullName: string;
  email: string;
  phone: string;
  courseIds: Array<number | string>;
  courseId?: number | string;
  batch: string;
  joinDate: string;
  password?: string;
};

export type AdminDashboardSummary = {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  totalCourses: number;
  activeEnrollments: number;
  totalFeesCollected: number;
  pendingFees: number;
  upcomingClasses: number;
  openSupportTickets: number;
  averageCourseProgress: number;
  averageAttendance: number;
  activeLearningTasks: number;
  completedTasks: number;
  newStudents: number;
  recentEnrollments: number;
  highPriorityTickets: number;
  inProgressSupportTickets: number;
  resolvedSupportTickets: number;
  totalCollected: number;
  pendingRevenue: number;
  overdueRevenue: number;
  thisMonthRevenue: number;
  thisYearRevenue: number;
  openTickets: number;
  inProgress: number;
  resolved: number;
  pending: number;
  overdue: number;
  thisMonth: number;
  thisYear: number;
};

export const adminService = {
  async getStudents() {
    return api.get<{ success: true; students: AdminStudent[] }>('/admin/students');
  },
  async getStudent(id: number | string) {
    return api.get<{ success: true; student: AdminStudent }>(`/admin/students/${id}`);
  },
  async getCourses() {
    return api.get<{ success: true; courses: AdminCourse[] }>('/admin/courses');
  },
  async createStudent(payload: StudentPayload) {
    return api.post<{ success: true; student: AdminStudent }>('/admin/students', payload);
  },
  async updateStudent(id: number | string, payload: StudentPayload) {
    return api.put<{ success: true; student: AdminStudent }>(`/admin/students/${id}`, payload);
  },
  async updateStudentStatus(id: number | string, status: AdminStudent['status']) {
    return api.patch<{ success: true; student: AdminStudent }>(`/admin/students/${id}/status`, { status });
  },
  async getDashboard() {
    return api.get<{ success: true; dashboard: AdminDashboardSummary; userId?: number }>('/admin/dashboard');
  },
  async getAnalytics() {
    return api.get('/admin/analytics');
  },
};
