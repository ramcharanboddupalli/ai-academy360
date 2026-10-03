import { Router, type Request, type Response } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { DatabaseConfigurationError, getDatabasePool } from '../config/database.js';
import { authenticateToken, requireStudent } from '../middleware/auth.middleware.js';
import { AIInvalidResponseError, AIProviderTimeoutError, AIProviderUnavailableError, aiService } from '../services/ai/ai.service.js';
import {
  getStudentAnnouncements,
  getStudentCertificates,
  getStudentCourses,
  getStudentDashboard,
  getStudentInternships,
  getStudentLearning,
  getStudentPayments,
  getStudentProfile,
  getStudentSchedule,
  markStudentAnnouncementRead,
} from '../services/studentDashboard.service.js';
import { generateLearningAdvisor, generatePerformanceAdvisor } from '../services/studentLearningAi.service.js';
import { generateStudentOpportunityMatch } from '../services/studentOpportunityAi.service.js';
import { createBulkNotifications } from '../services/notification.service.js';
import { z } from 'zod';

const router = Router();
router.use(authenticateToken, requireStudent);

const studentDoubtChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversation: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().trim().min(1).max(4000),
  }).strict()).max(12).default([]),
}).strict().superRefine((value, context) => {
  const totalCharacters = value.message.length + value.conversation.reduce((total, item) => total + item.content.length, 0);
  if (totalCharacters > 16_000) {
    context.addIssue({ code: 'custom', message: 'Conversation is too long.' });
  }
});

function handleFailure(res: Response, error: unknown, message: string) {
  if (error instanceof DatabaseConfigurationError) {
    return res.status(503).json({ success: false, message: 'Database is not configured.' });
  }
  return res.status(500).json({ success: false, message });
}

router.post('/ai-assistant/chat', async (req: Request, res: Response) => {
  const parsed = studentDoubtChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Enter a message and keep the conversation within the allowed length.' });
  }
  try {
    const reply = await aiService.answerStudentDoubt(parsed.data.message, parsed.data.conversation);
    return res.json({ success: true, data: { reply } });
  } catch (error) {
    if (error instanceof AIProviderTimeoutError) {
      return res.status(504).json({ success: false, message: 'The AI Doubt Assistant timed out. Please try again.' });
    }
    if (error instanceof AIInvalidResponseError) {
      return res.status(502).json({ success: false, message: 'The AI response could not be validated. Please retry.' });
    }
    if (error instanceof AIProviderUnavailableError && error.providerStatus === 429) {
      return res.status(429).json({ success: false, message: 'The AI Doubt Assistant is busy. Please wait a moment and try again.' });
    }
    return res.status(503).json({ success: false, message: 'The AI Doubt Assistant is temporarily unavailable. Please try again.' });
  }
});

router.get('/profile', async (req: Request, res: Response) => {
  try {
    const student = await getStudentProfile(req.authUser!.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found.' });
    return res.json({ success: true, student });
  } catch (error) {
    return handleFailure(res, error, 'Student profile could not be loaded.');
  }
});

router.get('/courses', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, courses: await getStudentCourses(req.authUser!.id) });
  } catch (error) {
    return handleFailure(res, error, 'Student courses could not be loaded.');
  }
});

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const dashboard = await getStudentDashboard(req.authUser!.id);
    if (!dashboard) return res.status(404).json({ success: false, message: 'Student dashboard could not be found.' });
    return res.json({ success: true, dashboard });
  } catch (error) {
    return handleFailure(res, error, 'Student dashboard could not be loaded.');
  }
});

router.get('/learning', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, learning: await getStudentLearning(req.authUser!.id) });
  } catch (error) {
    return handleFailure(res, error, 'Student learning data could not be loaded.');
  }
});

router.post('/learning/advisor', async (req: Request, res: Response) => {
  try {
    const learning = await getStudentLearning(req.authUser!.id);
    if (!learning.hasActivity) {
      return res.json({
        success: true,
        available: false,
        message: 'Not enough learning activity available for an AI insight yet.',
      });
    }
    const snapshot = {
      courses: learning.courses.map(({ name, status, progress, currentTopic, attendancePercent }) => ({ name, status, progress, currentTopic, attendancePercent })),
      attendance: learning.attendance.map(({ course, recordedClasses, attendedClasses, attendancePercent }) => ({ course, recordedClasses, attendedClasses, attendancePercent })),
      pendingTasks: learning.pendingTasks,
      completedTopics: learning.completedTopics.length,
      taskStatuses: learning.tasks.reduce<Record<string, number>>((counts, task) => {
        counts[String(task.status)] = (counts[String(task.status)] ?? 0) + 1;
        return counts;
      }, {}),
    };
    const advisor = await generateLearningAdvisor(snapshot);
    return res.json({ success: true, available: true, advisor });
  } catch {
    return res.status(503).json({ success: false, message: 'The AI Learning Advisor is temporarily unavailable.' });
  }
});

router.post('/performance-advisor/analyze', async (req: Request, res: Response) => {
  let learning: Awaited<ReturnType<typeof getStudentLearning>>;
  let classes: Awaited<ReturnType<typeof getStudentSchedule>>;
  try {
    [learning, classes] = await Promise.all([
      getStudentLearning(req.authUser!.id),
      getStudentSchedule(req.authUser!.id),
    ]);
  } catch (error) {
    return handleFailure(res, error, 'Student performance data could not be loaded.');
  }
  const snapshot = {
    courses: learning.courses.map(({ name, status, progress, currentTopic, attendancePercent }) => ({ name, status, progress, currentTopic, attendancePercent })),
    attendance: learning.attendance.map(({ course, recordedClasses, attendedClasses, attendancePercent }) => ({ course, recordedClasses, attendedClasses, attendancePercent })),
    tasks: learning.tasks.map(({ title, course, status, dueAt }) => ({ title, course, status, dueAt })),
    resources: learning.resources.map(({ title, course }) => ({ title, courseName: course })),
    upcomingClasses: classes
      .filter((item) => item.status === 'scheduled' || item.status === 'live')
      .map(({ course, title, startsAt }) => ({ course, title, startsAt })),
    completedTopics: learning.completedTopics.length,
  };
  if (!snapshot.courses.length && !snapshot.attendance.length && !snapshot.tasks.length && !snapshot.resources.length && !snapshot.upcomingClasses.length) {
    return res.json({ success: true, available: false, message: 'There is not enough recorded learning activity to generate a reliable analysis yet.' });
  }
  try {
    const advisor = await generatePerformanceAdvisor(snapshot);
    return res.json({ success: true, available: true, advisor });
  } catch {
    return res.status(503).json({ success: false, message: 'The AI Performance Advisor is temporarily unavailable or returned an invalid analysis.' });
  }
});

router.get('/schedule', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, classes: await getStudentSchedule(req.authUser!.id) });
  } catch (error) {
    return handleFailure(res, error, 'Student schedule could not be loaded.');
  }
});

router.get('/payments', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, ...(await getStudentPayments(req.authUser!.id)) });
  } catch (error) {
    return handleFailure(res, error, 'Student payments could not be loaded.');
  }
});

router.get('/certificates', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, certificates: await getStudentCertificates(req.authUser!.id) });
  } catch (error) {
    return handleFailure(res, error, 'Student certificates could not be loaded.');
  }
});

router.get('/internships', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, ...(await getStudentInternships(req.authUser!.id)) });
  } catch (error) {
    return handleFailure(res, error, 'Internship opportunities could not be loaded.');
  }
});

router.post('/internships/:id/applications', async (req: Request, res: Response) => {
  const internshipId = Number(req.params.id);
  if (!Number.isSafeInteger(internshipId) || internshipId < 1) {
    return res.status(400).json({ success: false, message: 'Internship ID is invalid.' });
  }
  try {
    const connection = await getDatabasePool().getConnection();
    try {
      await connection.beginTransaction();
      const [students] = await connection.execute<RowDataPacket[]>(
        `SELECT id FROM students WHERE user_id = ? AND status = 'Active' LIMIT 1 FOR UPDATE`,
        [req.authUser!.id],
      );
      if (!students[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'Active student profile not found.' });
      }
      const [internships] = await connection.execute<RowDataPacket[]>(
        `SELECT id, title FROM internships
         WHERE id = ? AND is_published = TRUE
           AND (application_deadline IS NULL OR application_deadline >= CURRENT_TIMESTAMP)
         LIMIT 1 FOR UPDATE`,
        [internshipId],
      );
      if (!internships[0]) {
        await connection.rollback();
        return res.status(404).json({ success: false, message: 'This published internship is no longer accepting applications.' });
      }
      const [result] = await connection.execute(
        'INSERT INTO internship_applications (internship_id, student_id, status) VALUES (?, ?, \'applied\')',
        [internshipId, students[0].id],
      );
      const applicationId = Number((result as { insertId: number | string }).insertId);
      const [admins] = await connection.execute<RowDataPacket[]>(
        `SELECT u.id AS userId FROM users u JOIN admins a ON a.user_id = u.id
         WHERE u.role = 'ADMIN' AND u.is_active = TRUE`,
      );
      await createBulkNotifications(connection, admins.map((admin) => ({
        userId: Number(admin.userId),
        title: 'New internship application',
        message: `A student applied for ${internships[0].title}.`,
        type: 'INTERNSHIP',
        referenceType: 'internship_application',
        referenceId: applicationId,
        dedupeKey: `internship-application:${applicationId}:new:${admin.userId}`,
      })));
      await connection.commit();
      return res.status(201).json({ success: true, applicationId });
    } catch (error) {
      await connection.rollback();
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'You have already applied to this internship.' });
      }
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return handleFailure(res, error, 'Internship application could not be submitted.');
  }
});

router.post('/internships/:id/match', async (req: Request, res: Response) => {
  const internshipId = Number(req.params.id);
  if (!Number.isSafeInteger(internshipId) || internshipId < 1) {
    return res.status(400).json({ success: false, message: 'Internship ID is invalid.' });
  }
  try {
    const result = await generateStudentOpportunityMatch(req.authUser!.id, internshipId);
    if (!result.found) return res.status(404).json({ success: false, message: 'Published opportunity not found.' });
    if (!result.available) return res.json({ success: true, available: false, message: 'Not enough course and opportunity requirement data for a useful match.' });
    return res.json({ success: true, available: true, provider: result.provider, model: result.model, match: result.match });
  } catch {
    return res.status(503).json({ success: false, message: 'AI Opportunity Match is temporarily unavailable.' });
  }
});

router.get('/announcements', async (req: Request, res: Response) => {
  try {
    return res.json({ success: true, announcements: await getStudentAnnouncements(req.authUser!.id) });
  } catch (error) {
    return handleFailure(res, error, 'Announcements could not be loaded.');
  }
});

router.patch('/announcements/:id/read', async (req: Request, res: Response) => {
  const announcementId = Number(req.params.id);
  if (!Number.isSafeInteger(announcementId) || announcementId < 1) {
    return res.status(400).json({ success: false, message: 'Announcement ID is invalid.' });
  }
  try {
    const marked = await markStudentAnnouncementRead(req.authUser!.id, announcementId);
    if (!marked) return res.status(404).json({ success: false, message: 'Announcement not found.' });
    return res.json({ success: true });
  } catch (error) {
    return handleFailure(res, error, 'Announcement could not be marked as read.');
  }
});

export default router;