import axios from 'axios';

type AuthErrorContext = 'management-login' | 'student-login' | 'signup';

export function authErrorMessage(error: unknown, context: AuthErrorContext): string {
  if (!axios.isAxiosError(error)) {
    return 'Unable to connect right now. Check your connection and try again.';
  }

  const status = error.response?.status;
  if (status === 401 && context === 'management-login') return 'Invalid email or password.';
  if (status === 401 && context === 'student-login') return 'Invalid Student ID or password.';
  if (status === 400) {
    const message = error.response?.data?.message;
    return typeof message === 'string' ? message : 'Check the information you entered.';
  }
  if (status === 409) return 'An account with this email already exists.';
  if (status === 503 || (typeof status === 'number' && status >= 500)) {
    return 'The authentication service is temporarily unavailable. Please try again shortly.';
  }
  if (!status) return 'Unable to connect right now. Check your connection and try again.';
  return context === 'signup' ? 'Unable to create the account. Please try again.' : 'Unable to sign in. Please try again.';
}
