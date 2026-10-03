import { z } from 'zod';

export const AI_INTENTS = ['student_support', 'course_help', 'payment_issue', 'complaint', 'general_query'] as const;
export const AI_CATEGORIES = ['academic', 'admissions', 'billing', 'technical', 'administrative', 'wellbeing', 'other'] as const;
export const AI_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export const AI_SENTIMENTS = ['POSITIVE', 'NEUTRAL', 'FRUSTRATED', 'NEGATIVE'] as const;
export const DEFAULT_AI_DEPARTMENTS = ['student_support', 'academic_advising', 'finance', 'it_support', 'admin_ops', 'faculty'] as const;

export interface AIRequestInput {
  message: string;
}

export interface AIAnalysisResult {
  intent: (typeof AI_INTENTS)[number];
  category: (typeof AI_CATEGORIES)[number];
  priority: (typeof AI_PRIORITIES)[number];
  department: string;
  sentiment: (typeof AI_SENTIMENTS)[number];
  summary: string;
  suggestedResponse: string;
  recommendedAction: string;
  confidence: number;
}

export interface AIManagementInsightsResult {
  summary: string;
  keyIssues: string[];
  riskAreas: string[];
  recommendations: string[];
  priorityAction: string;
}

export interface AIAdminCopilotResult {
  answer: string;
  keyMetrics: Array<{ label: string; value: string; sourceField: string }>;
  supportingPoints: string[];
  recommendedActions: string[];
}

export function createAIAnalysisSchema(departments: string[]) {
  const allowedDepartments = new Set(departments);
  return z.object({
    intent: z.enum(AI_INTENTS),
    category: z.enum(AI_CATEGORIES),
    priority: z.enum(AI_PRIORITIES),
    department: z.string().min(1).refine((department) => allowedDepartments.has(department)),
    sentiment: z.enum(AI_SENTIMENTS),
    summary: z.string().min(1).max(1000),
    suggestedResponse: z.string().min(1).max(3000),
    recommendedAction: z.string().min(1).max(2000),
    confidence: z.number().min(0).max(1),
  }).strict();
}

export function createAIManagementInsightsSchema() {
  return z.object({
    summary: z.string().min(1).max(1200),
    keyIssues: z.array(z.string().min(1).max(500)).min(1).max(5),
    riskAreas: z.array(z.string().min(1).max(500)).max(5),
    recommendations: z.array(z.string().min(1).max(500)).min(1).max(5),
    priorityAction: z.string().min(1).max(500),
  }).strict();
}

export function createAIAdminCopilotSchema() {
  return z.object({
    answer: z.string().min(1).max(2000),
    keyMetrics: z.array(z.object({
      label: z.string().min(1).max(100),
      value: z.string().min(1).max(100),
      sourceField: z.string().min(1).max(150),
    }).strict()).max(8),
    supportingPoints: z.array(z.string().min(1).max(500)).max(6),
    recommendedActions: z.array(z.string().min(1).max(500)).max(6),
  }).strict();
}
