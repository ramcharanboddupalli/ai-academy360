import axios from 'axios';

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:5000/api';
const normalizedApiBaseUrl = configuredApiBaseUrl.replace(/\/+$/, '');
const apiBaseUrl = /\/api$/i.test(normalizedApiBaseUrl)
  ? normalizedApiBaseUrl
  : `${normalizedApiBaseUrl}/api`;

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 35000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export function setAccessToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export default api;
