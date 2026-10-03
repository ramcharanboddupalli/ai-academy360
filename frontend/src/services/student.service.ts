import api from './api';

export type StudentProfile = {
  id: number | string;
  studentId: string;
  fullName: string;
  email: string;
  phone: string;
  courseId: number | string;
  course: string;
  courses: Array<{ id: number | string; code: string; name: string; status: 'active' | 'completed'; batch: string; enrollmentDate: string }>;
  batch: string;
  joinDate: string;
  status: string;
};

export type StudentCourse = {
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

export const studentService = {
  async getProfile() {
    return api.get<{ success: true; student: StudentProfile }>('/student/profile');
  },
  async getCourses() {
    return api.get<{ success: true; courses: StudentCourse[] }>('/student/courses');
  },
};
