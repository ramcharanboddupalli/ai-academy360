import api from './api';

export type DoubtConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const studentAiAssistantService = {
  sendMessage(message: string, conversation: DoubtConversationMessage[], signal?: AbortSignal) {
    return api.post<{ success: true; data: { reply: string } }>(
      '/student/ai-assistant/chat',
      { message, conversation },
      { signal },
    );
  },
};