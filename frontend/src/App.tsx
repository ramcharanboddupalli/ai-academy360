import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicLayout } from './layouts/PublicLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { HomePage } from './pages/HomePage';
import { ManagementLoginPage, LoginPage, StudentLoginPage } from './pages/auth/LoginPage';
import { StudentDashboardPage } from './pages/student/DashboardPage';
import { StudentLearningPage } from './pages/student/LearningPage';
import { StudentCoursesPage } from './pages/student/CoursesPage';
import { StudentSchedulePage } from './pages/student/SchedulePage';
import { StudentPaymentsPage } from './pages/student/PaymentsPage';
import { StudentCertificatesPage } from './pages/student/CertificatesPage';
import { StudentInternshipsPage } from './pages/student/InternshipsPage';
import { StudentSupportPage } from './pages/student/SupportPage';
import { StudentComplaintsPage } from './pages/student/ComplaintsPage';
import { StudentProfilePage } from './pages/student/ProfilePage';
import { StudentAnnouncementsPage } from './pages/student/AnnouncementsPage';
import { AiDoubtAssistantPage } from './pages/student/AiDoubtAssistantPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { AdminStudentsPage } from './pages/admin/StudentsPage';
import { AdminCoursesPage } from './pages/admin/CoursesPage';
import { AdminPaymentsPage } from './pages/admin/PaymentsPage';
import { AdminComplaintsPage } from './pages/admin/ComplaintsPage';
import { AdminAnalyticsPage } from './pages/admin/AnalyticsPage';
import { AdminAIInsightsPage } from './pages/admin/AIInsightsPage';
import { AdminSettingsPage } from './pages/admin/SettingsPage';
import { AdminAcademyManagementPage } from './pages/admin/AcademyManagementPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PerformanceAdvisorPage } from './pages/student/PerformanceAdvisorPage';
import { AdminAICopilotPage } from './pages/admin/AICopilotPage';
import { ManagementSignupPage } from './pages/auth/ManagementSignupPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/management/login" element={<ManagementLoginPage />} />
          <Route path="/management/signup" element={<ManagementSignupPage />} />
          <Route path="/login/student" element={<StudentLoginPage />} />
        </Route>

        <Route element={<ProtectedRoute role="STUDENT"><StudentLayout /></ProtectedRoute>}>
          <Route path="/student/dashboard" element={<StudentDashboardPage />} />
          <Route path="/student/courses" element={<StudentCoursesPage />} />
          <Route path="/student/learning" element={<StudentLearningPage />} />
          <Route path="/student/ai-assistant" element={<AiDoubtAssistantPage />} />
          <Route path="/student/performance-advisor" element={<PerformanceAdvisorPage />} />
          <Route path="/student/schedule" element={<StudentSchedulePage />} />
          <Route path="/student/payments" element={<StudentPaymentsPage />} />
          <Route path="/student/certificates" element={<StudentCertificatesPage />} />
          <Route path="/student/internships" element={<StudentInternshipsPage />} />
          <Route path="/student/support" element={<StudentSupportPage />} />
          <Route path="/student/complaints" element={<StudentComplaintsPage />} />
          <Route path="/student/profile" element={<StudentProfilePage />} />
          <Route path="/student/announcements" element={<StudentAnnouncementsPage />} />
          <Route path="/student/notifications" element={<NotificationsPage role="STUDENT" />} />
        </Route>

        <Route element={<ProtectedRoute role="ADMIN"><AdminLayout /></ProtectedRoute>}>
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/students" element={<AdminStudentsPage />} />
          <Route path="/admin/courses" element={<AdminCoursesPage />} />
          <Route path="/admin/payments" element={<AdminPaymentsPage />} />
          <Route path="/admin/management" element={<AdminAcademyManagementPage />} />
          <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
          <Route path="/admin/ai-insights" element={<AdminAIInsightsPage />} />
          <Route path="/admin/ai-copilot" element={<AdminAICopilotPage />} />
          <Route path="/admin/settings" element={<AdminSettingsPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage role="ADMIN" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
