import { apiFetch } from '@/utils/auth/client';
import type { UserDto } from '@app/contracts';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return apiFetch<T>(endpoint, {
    ...options,
    headers,
  });
}

export async function fetchMe(token?: string): Promise<UserDto> {
  return apiRequest<UserDto>('/v1/me', { method: 'GET' }, token);
}
