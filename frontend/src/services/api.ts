import axios from 'axios';
import { User, ScheduledEmail, ScheduleFormInput, SlackStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

export const apiClient = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth APIs
export async function googleLoginApi(idToken: string): Promise<{ token: string; user: User }> {
  const response = await apiClient.post('/auth/google', { idToken });
  return response.data;
}

export async function getCurrentUserApi(): Promise<{ user: User }> {
  const response = await apiClient.get('/auth/me');
  return response.data;
}

// Email APIs
export async function scheduleEmailsApi(
  data: ScheduleFormInput
): Promise<{ message: string; count: number; emails: ScheduledEmail[] }> {
  const response = await apiClient.post('/emails/schedule', data);
  return response.data;
}

export async function getScheduledEmailsApi(
  page = 1,
  limit = 50
): Promise<{ total: number; page: number; emails: ScheduledEmail[] }> {
  const response = await apiClient.get('/emails/scheduled', {
    params: { page, limit },
  });
  return response.data;
}

export async function getSentEmailsApi(
  page = 1,
  limit = 50
): Promise<{ total: number; page: number; emails: ScheduledEmail[] }> {
  const response = await apiClient.get('/emails/sent', {
    params: { page, limit },
  });
  return response.data;
}

export async function searchEmailsApi(
  query: string,
  status?: string
): Promise<{ source: string; total: number; emails: ScheduledEmail[] }> {
  const response = await apiClient.get('/emails/search', {
    params: { q: query, status },
  });
  return response.data;
}

export async function cancelEmailApi(id: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete(`/emails/${id}`);
  return response.data;
}

// Slack APIs
export async function getSlackStatusApi(): Promise<SlackStatus> {
  const response = await apiClient.get('/slack/status');
  return response.data;
}

export async function getSlackOAuthUrlApi(): Promise<{ url: string }> {
  const response = await apiClient.get('/slack/oauth/start');
  return response.data;
}

export async function disconnectSlackApi(): Promise<{ success: boolean }> {
  const response = await apiClient.post('/slack/disconnect');
  return response.data;
}
