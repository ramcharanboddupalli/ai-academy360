import OpenAI from 'openai';
import { z } from 'zod';
import type { RowDataPacket } from 'mysql2/promise';
import { getDatabasePool } from '../config/database.js';

const matchSchema = z.object({
  matchExplanation: z.string().min(1).max(800),
  matchingSkills: z.array(z.string().min(1).max(120)).max(8),
  skillsToDevelop: z.array(z.string().min(1).max(120)).max(8),
}).strict();

let client: OpenAI | null = null;
let configuredKey: string | null = null;

async function getSnapshot(userId: number, internshipId: number) {
  const [opportunities] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT id, title, organization, requirements, skill_requirements AS skillRequirements
     FROM internships WHERE id = ? AND is_published = TRUE
       AND (application_deadline IS NULL OR application_deadline >= CURRENT_TIMESTAMP) LIMIT 1`,
    [internshipId],
  );
  if (!opportunities[0]) return null;
  const [courses] = await getDatabasePool().execute<RowDataPacket[]>(
    `SELECT c.title AS name FROM students s
     INNER JOIN enrollments e ON e.student_id = s.id AND e.status <> 'dropped'
     INNER JOIN courses c ON c.id = e.course_id
     WHERE s.user_id = ? AND s.status = 'Active' ORDER BY c.title`,
    [userId],
  );
  const opportunity = opportunities[0];
  const parseJson = (value: unknown) => typeof value === 'string' ? JSON.parse(value) : value;
  const requirements = parseJson(opportunity.requirements) ?? [];
  const skillRequirements = parseJson(opportunity.skillRequirements) ?? [];
  if (!courses.length || (!Array.isArray(requirements) || requirements.length === 0)
    && (!Array.isArray(skillRequirements) || skillRequirements.length === 0)) {
    return { available: false as const };
  }
  return {
    available: true as const,
    snapshot: {
      enrolledCourseNames: courses.map((course) => String(course.name)),
      opportunity: {
        title: opportunity.title,
        organization: opportunity.organization,
        requirements,
        skillRequirements,
      },
    },
  };
}

export async function generateStudentOpportunityMatch(userId: number, internshipId: number) {
  const result = await getSnapshot(userId, internshipId);
  if (!result) return { found: false as const };
  if (!result.available) return { found: true as const, available: false as const };

  const key = process.env.GROQ_API_KEY?.trim()
    || (process.env.AI_API_KEY?.trim().startsWith('gsk_') ? process.env.AI_API_KEY.trim() : '');
  const model = process.env.AI_MODEL?.trim();
  if (!key || !model || /your_api_key|YOUR_|CHANGE_ME|REPLACE/i.test(key)) throw new Error('Groq is not configured.');
  if (!client || configuredKey !== key) {
    client = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1', timeout: 25_000, maxRetries: 0 });
    configuredKey = key;
  }

  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'Compare the supplied published internship requirements with the student enrolled course titles. Course titles are evidence of enrollment only, not evidence of mastery. Never invent skills or imply selection/guaranteed acceptance. Put only requirement phrases directly supported by a course title in matchingSkills. Put requirement phrases without direct evidence in skillsToDevelop. Use only phrases provided in the JSON; return the required JSON only.' },
      { role: 'user', content: JSON.stringify(result.snapshot) },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'student_opportunity_match',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['matchExplanation', 'matchingSkills', 'skillsToDevelop'],
          properties: {
            matchExplanation: { type: 'string' },
            matchingSkills: { type: 'array', items: { type: 'string' } },
            skillsToDevelop: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    max_completion_tokens: 800,
  });
  const content = response.choices[0]?.message.content;
  if (!content || response.choices[0]?.message.refusal) throw new Error('Groq returned no opportunity analysis.');
  const parsed = matchSchema.safeParse(JSON.parse(content));
  if (!parsed.success) throw new Error('Groq returned an invalid opportunity match.');
  const requirementTerms = [result.snapshot.opportunity.requirements, result.snapshot.opportunity.skillRequirements]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .flatMap((value) => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value) : [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase());
  const unsupportedTerms = [...parsed.data.matchingSkills, ...parsed.data.skillsToDevelop]
    .filter((value) => !requirementTerms.includes(value.trim().toLowerCase()));
  const suppliedNumbers = new Set(JSON.stringify(result.snapshot).match(/\b\d+(?:\.\d+)?\b/g) ?? []);
  const outputText = [parsed.data.matchExplanation, ...parsed.data.matchingSkills, ...parsed.data.skillsToDevelop].join(' ');
  const unsupportedNumbers = (outputText.match(/\b\d+(?:\.\d+)?\b/g) ?? []).filter((value) => !suppliedNumbers.has(value));
  if (unsupportedTerms.length > 0 || unsupportedNumbers.length > 0) throw new Error('Groq returned unsupported opportunity claims.');
  return { found: true as const, available: true as const, match: parsed.data, provider: 'Groq', model: response.model || model };
}