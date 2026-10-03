import api from './api';

export type AuthRole = 'ADMIN' | 'STUDENT';

export type AuthUser = {
  id: number;
  role: AuthRole;
  name: string;
  studentId?: string;
};

export type LoginPayload =
  | {
      role: 'ADMIN';
      email: string;
      password: string;
    }
  | {
      role: 'STUDENT';
      studentId: string;
      password: string;
    };

export type AuthResponse = {
  success: true;
  token: string;
  user: AuthUser;
};

export const authService = {
  async login(payload: LoginPayload) {
    if (payload.role === 'ADMIN') {
      return api.post<AuthResponse>('/auth/admin/login', { email: payload.email, password: payload.password });
    }
    return api.post<AuthResponse>('/auth/student/login', { studentId: payload.studentId, password: payload.password });
  },
  async getCurrentUser() {
    return api.get<{ success: true; user: AuthUser }>('/auth/me');
  },
  async logout() {
    return api.post('/auth/logout');
  },
};
