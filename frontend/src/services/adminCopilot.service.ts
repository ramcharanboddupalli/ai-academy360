import api from './api';

export type AdminCopilotResponse = {
  answer: string;
  keyMetrics: Array<{ label: string; value: string; sourceField: string }>;
  supportingPoints: string[];
  recommendedActions: string[];
};

export const adminCopilotService = {
  ask(question: string) {
    return api.post<{ success: true; response: AdminCopilotResponse; provider: 'Groq'; model: string }>('/admin/ai-copilot/ask', { question }, { timeout: 40000 });
  },
};
