import OpenAI from 'openai';
import { z } from 'zod';

const learningAdvisorSchema = z.object({
  summary: z.string().min(1).max(800),
  focusAreas: z.array(z.string().min(1).max(300)).max(4),
  recommendedNextSteps: z.array(z.string().min(1).max(300)).max(4),
  attendanceNote: z.string().min(1).max(300),
  priority: z.enum(['low', 'medium', 'high']),
}).strict();

const performanceAdvisorSchema = z.object({
  overallSummary: z.string().min(1).max(1000),
  strengths: z.array(z.string().min(1).max(300)).max(5),
  areasToImprove: z.array(z.string().min(1).max(300)).max(5),
  priorityActions: z.array(z.string().min(1).max(300)).max(5),
  recommendedResources: z.array(z.object({
    title: z.string().min(1).max(255),
    courseName: z.string().min(1).max(255),
    reason: z.string().min(1).max(300),
  }).strict()).max(5),
  studyFocus: z.array(z.string().min(1).max(300)).max(5),
  attendanceInsight: z.string().min(1).max(300),
  taskInsight: z.string().min(1).max(300),
  courseInsights: z.array(z.object({
    courseName: z.string().min(1).max(255),
    progress: z.number().min(0).max(100).nullable(),
    insight: z.string().min(1).max(300),
  }).strict()).max(20),
}).strict();

const groqBaseUrl = 'https://api.groq.com/openai/v1';
let client: OpenAI | null = null;
let configuredKey: string | null = null;

function getGroqClient() {
  const key = process.env.GROQ_API_KEY?.trim()
    || (process.env.AI_API_KEY?.trim().startsWith('gsk_') ? process.env.AI_API_KEY.trim() : '');
  const model = process.env.AI_MODEL?.trim();
  if (!key || !model || /your_api_key|YOUR_|CHANGE_ME|REPLACE/i.test(key)) throw new Error('Groq is not configured.');
  if (!client || configuredKey !== key) {
    client = new OpenAI({ apiKey: key, baseURL: groqBaseUrl, timeout: 25_000, maxRetries: 0 });
    configuredKey = key;
  }
  return { client, model };
}

function unsupportedNumbers(result: z.infer<typeof learningAdvisorSchema>, snapshot: unknown) {
  const allowed = new Set(JSON.stringify(snapshot).match(/\b\d+(?:\.\d+)?\b/g) ?? []);
  const text = [result.summary, ...result.focusAreas, ...result.recommendedNextSteps, result.attendanceNote].join(' ');
  return (text.match(/\b\d+(?:\.\d+)?\b/g) ?? []).filter((value) => !allowed.has(value));
}

export async function generateLearningAdvisor(snapshot: unknown) {
  const { client: groq, model } = getGroqClient();
  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a student learning advisor. Use only the supplied academic snapshot. Do not invent progress, attendance, tasks, completions, skills, causes, or dates. Mention a numeric value only when that exact number appears in the JSON. Do not infer percentages, compare to peers, or guarantee outcomes. Return only the requested structured JSON.' },
      { role: 'user', content: JSON.stringify({ academicSnapshot: snapshot }) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'student_learning_advisor',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'focusAreas', 'recommendedNextSteps', 'attendanceNote', 'priority'],
          properties: {
            summary: { type: 'string' },
            focusAreas: { type: 'array', items: { type: 'string' } },
            recommendedNextSteps: { type: 'array', items: { type: 'string' } },
            attendanceNote: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
    },
    max_completion_tokens: 900,
  });
  const content = response.choices[0]?.message.content;
  if (!content || response.choices[0]?.message.refusal) throw new Error('Groq did not return an advisor response.');
  const parsed = learningAdvisorSchema.safeParse(JSON.parse(content));
  if (!parsed.success || unsupportedNumbers(parsed.data, snapshot).length > 0) {
    throw new Error('Groq returned an invalid advisor response.');
  }
  return { ...parsed.data, provider: 'Groq', model: response.model || model };
}

function findUnsupportedPerformanceClaims(
  result: z.infer<typeof performanceAdvisorSchema>,
  snapshot: { courses: Array<{ name: string; progress: number | null }>; resources: Array<{ title: string; courseName: string }> },
) {
  const allowedNumbers = new Set(JSON.stringify(snapshot).match(/\b\d+(?:\.\d+)?\b/g) ?? []);
  const text = [
    result.overallSummary,
    ...result.strengths,
    ...result.areasToImprove,
    ...result.priorityActions,
    ...result.studyFocus,
    result.attendanceInsight,
    result.taskInsight,
    ...result.courseInsights.map((item) => item.insight),
    ...result.recommendedResources.map((item) => item.reason),
  ].join(' ');
  const unsupportedNumbers = (text.match(/\b\d+(?:\.\d+)?\b/g) ?? []).filter((number) => !allowedNumbers.has(number));
  const courseData = new Map(snapshot.courses.map((course) => [course.name, course.progress]));
  const invalidCourses = result.courseInsights.some((item) =>
    !courseData.has(item.courseName) || courseData.get(item.courseName) !== item.progress,
  );
  const resourceData = new Set(snapshot.resources.map((resource) => `${resource.courseName}\u0000${resource.title}`));
  const invalidResources = result.recommendedResources.some((resource) =>
    !resourceData.has(`${resource.courseName}\u0000${resource.title}`),
  );
  return { unsupportedNumbers, invalidCourses, invalidResources };
}

export async function generatePerformanceAdvisor(
  snapshot: {
    courses: Array<{ name: string; status: string; progress: number | null; currentTopic: string | null; attendancePercent: number | null }>;
    attendance: Array<{ course: string; recordedClasses: number; attendedClasses: number; attendancePercent: number }>;
    tasks: Array<{ title: string; course: string; status: string; dueAt: string | null }>;
    resources: Array<{ title: string; courseName: string }>;
    upcomingClasses: Array<{ course: string; title: string; startsAt: string }>;
    completedTopics: number;
  },
) {
  const { client: groq, model } = getGroqClient();
  const response = await groq.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are an academic performance advisor. Give specific supportive guidance using only the supplied authenticated student academic snapshot. Never invent a course, resource, task, completion, skill, deadline, date, attendance value, cause, progress metric or outcome. Every course insight must use the exact course name and exact progress value from the snapshot (or null). Every recommended resource must exactly match a resource title and course from the snapshot. Use no numeric value unless it appears exactly in the snapshot. Do not use payment, identity, contact or peer data. If activity is sparse, say so directly. Return only the requested JSON.' },
      { role: 'user', content: JSON.stringify({ academicSnapshot: snapshot }) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'student_performance_advisor',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['overallSummary', 'strengths', 'areasToImprove', 'priorityActions', 'recommendedResources', 'studyFocus', 'attendanceInsight', 'taskInsight', 'courseInsights'],
          properties: {
            overallSummary: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            areasToImprove: { type: 'array', items: { type: 'string' } },
            priorityActions: { type: 'array', items: { type: 'string' } },
            recommendedResources: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'courseName', 'reason'], properties: { title: { type: 'string' }, courseName: { type: 'string' }, reason: { type: 'string' } } } },
            studyFocus: { type: 'array', items: { type: 'string' } },
            attendanceInsight: { type: 'string' },
            taskInsight: { type: 'string' },
            courseInsights: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['courseName', 'progress', 'insight'], properties: { courseName: { type: 'string' }, progress: { anyOf: [{ type: 'number' }, { type: 'null' }] }, insight: { type: 'string' } } } },
          },
        },
      },
    },
    max_completion_tokens: 1500,
  });
  const content = response.choices[0]?.message.content;
  if (!content || response.choices[0]?.message.refusal) throw new Error('Groq did not return a performance advisor response.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('Groq returned malformed performance advisor JSON.');
  }
  const validated = performanceAdvisorSchema.safeParse(parsed);
  if (!validated.success) throw new Error('Groq returned an invalid performance advisor response.');
  const claims = findUnsupportedPerformanceClaims(validated.data, snapshot);
  if (claims.unsupportedNumbers.length || claims.invalidCourses || claims.invalidResources) {
    throw new Error('Groq returned unsupported performance advisor claims.');
  }
  return { ...validated.data, provider: 'Groq', model: response.model || model };
}