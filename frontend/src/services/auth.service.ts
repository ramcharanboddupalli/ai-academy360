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

export type ManagementSignupPayload = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export const authService = {
  async login(payload: LoginPayload) {
    if (payload.role === 'ADMIN') {
      return api.post<AuthResponse>('/auth/management/login', { email: payload.email, password: payload.password });
    }
    return api.post<AuthResponse>('/auth/student/login', { studentId: payload.studentId, password: payload.password });
  },
  async signupManagement(payload: ManagementSignupPayload) {
    return api.post<{ success: true; message: string; user: AuthUser }>('/auth/management/signup', {
      fullName: payload.fullName,
      email: payload.email,
      password: payload.password,
      confirmPassword: payload.confirmPassword,
    });
  },
  async getCurrentUser() {
    return api.get<{ success: true; user: AuthUser }>('/auth/me');
  },
  async logout() {
    return api.post('/auth/logout');
  },
};
