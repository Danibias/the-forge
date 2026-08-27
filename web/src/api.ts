import type { AppState, Focus, FocusDay, Ledger } from './types';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const getState = () => json<AppState>('/api/state');

export const getLedger = () => json<{ ledger: Ledger; focus: Focus }>('/api/ledger');

export const logFocus = (kind: 'focus' | 'break', minutes: number) =>
  json<{ focus: Focus; week: FocusDay[] }>('/api/focus', {
    method: 'POST',
    body: JSON.stringify({ kind, minutes }),
  });
