import api from './api';
import type { StudentCourse, StudentProfile } from './student.service';

export type StudentClass = {
  id: number | string;
  courseId: number | string;
  course: string;
  title: string;
  startsAt: string;
  endsAt: string;
  instructor: string | null;
  location: string | null;
  meetingUrl: string | null;
  status: 'scheduled' | 'live';
  recordingUrl: string | null;
  recordingAvailable: boolean;
};

export type StudentAnnouncement = {
  id: number | string;
  title: string;
  message: string;
  category: 'general' | 'course' | 'schedule' | 'payment' | 'internship' | 'important';
  publishedAt: string;
  isRead: boolean;
};

export type StudentDashboard = {
  student: StudentProfile;
  activeCourseCount: number;
  overallProgress: number | null;
  attendancePercent: number | null;
  pendingTasks: number;
  courses: StudentCourse[];
  todayAndUpcomingClasses: StudentClass[];
  recentAnnouncements: StudentAnnouncement[];
  support: {
    totalTickets: number;
    activeTickets: number;
    recentTickets: Array<{ ticketNumber: string; title: string; status: string; updatedAt: string }>;
  };
  learningActivityAvailable: boolean;
};

export type StudentLearning = {
  courses: StudentCourse[];
  tasks: Array<{ id: number | string; courseId: number | string; course: string; title: string; description: string | null; dueAt: string | null; status: string; completedAt: string | null }>;
  attendance: Array<{ courseId: number | string; course: string; recordedClasses: number; attendedClasses: number; attendancePercent: number }>;
  resources: Array<{ id: number | string; courseId: number | string; course: string; title: string; description: string | null; resourceType: string; resourceUrl: string | null; createdAt: string }>;
  completedTopics: Array<{ id: number | string; courseId: number | string; course: string; title: string; completedAt: string }>;
  overallProgress: number | null;
  attendancePercent: number | null;
  pendingTasks: number;
  hasActivity: boolean;
};

export type StudentPayment = {
  id: number | string;
  course: string | null;
  amount: number;
  currency: string;
  paymentDate: string | null;
  dueDate: string | null;
  paymentMethod: 'upi' | 'bank_transfer' | 'cash' | 'card' | 'other' | null;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  referenceId: string | null;
  receiptUrl: string | null;
};

export type StudentCertificate = {
  id: number | string;
  title: string;
  course: string;
  certificateId: string;
  status: 'pending' | 'issued' | 'revoked';
  issueDate: string | null;
  fileUrl: string | null;
};

export type StudentInternship = {
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
};

export type StudentInternshipApplication = {
  id: number | string;
  internshipId: number | string;
  title: string;
  organization: string;
  duration: string | null;
  status: 'applied' | 'under_review' | 'shortlisted' | 'in_progress' | 'completed' | 'rejected' | 'selected' | 'withdrawn';
  appliedAt: string;
  updatedAt: string;
  adminNote: string | null;
};

export type LearningAdvisor = {
  summary: string;
  focusAreas: string[];
  recommendedNextSteps: string[];
  attendanceNote: string;
  priority: 'low' | 'medium' | 'high';
  provider: 'Groq';
  model: string;
};

export type PerformanceAdvisor = {
  overallSummary: string;
  strengths: string[];
  areasToImprove: string[];
  priorityActions: string[];
  recommendedResources: Array<{ title: string; courseName: string; reason: string }>;
  studyFocus: string[];
  attendanceInsight: string;
  taskInsight: string;
  courseInsights: Array<{ courseName: string; progress: number | null; insight: string }>;
  provider: 'Groq';
  model: string;
};

export type OpportunityMatch = {
  matchExplanation: string;
  matchingSkills: string[];
  skillsToDevelop: string[];
};

export const studentDashboardService = {
  getDashboard() {
    return api.get<{ success: true; dashboard: StudentDashboard }>('/student/dashboard');
  },
  getLearning() {
    return api.get<{ success: true; learning: StudentLearning }>('/student/learning');
  },
  getSchedule() {
    return api.get<{ success: true; classes: StudentClass[] }>('/student/schedule');
  },
  getPayments() {
    return api.get<{ success: true; payments: StudentPayment[]; totalsByCurrency: Record<string, { total: number; paid: number; pending: number }> }>('/student/payments');
  },
  getCertificates() {
    return api.get<{ success: true; certificates: StudentCertificate[] }>('/student/certificates');
  },
  verifyCertificate(certificateNumber: string) {
    return api.get<{ success: true; certificate: { certificateNumber: string; title: string; course: string; status: string; issueDate: string | null; verificationStatus: string } }>(`/certificates/verify/${encodeURIComponent(certificateNumber)}`);
  },
  getInternships() {
    return api.get<{ success: true; opportunities: StudentInternship[]; applications: StudentInternshipApplication[] }>('/student/internships');
  },
  applyToInternship(id: number | string) {
    return api.post<{ success: true; applicationId: number | string }>(`/student/internships/${id}/applications`, {});
  },
  matchInternship(id: number | string) {
    return api.post<{ success: true; available: false; message: string } | { success: true; available: true; provider: 'Groq'; model: string; match: OpportunityMatch }>(`/student/internships/${id}/match`, {});
  },
  getAnnouncements() {
    return api.get<{ success: true; announcements: StudentAnnouncement[] }>('/student/announcements');
  },
  markAnnouncementRead(id: number | string) {
    return api.patch<{ success: true }>(`/student/announcements/${id}/read`);
  },
  generateLearningAdvisor() {
    return api.post<{ success: true; available: false; message: string } | { success: true; available: true; advisor: LearningAdvisor }>('/student/learning/advisor', {});
  },
  generatePerformanceAdvisor() {
    return api.post<{ success: true; available: false; message: string } | { success: true; available: true; advisor: PerformanceAdvisor }>('/student/performance-advisor/analyze', {});
  },
};