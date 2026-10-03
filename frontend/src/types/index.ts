export type UserRole = 'student' | 'admin';

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface TicketStatus {
  label: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
}
