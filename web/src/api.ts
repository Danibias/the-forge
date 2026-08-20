import type { AppState, Focus, ForgeEvent, Ledger } from './types';

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
  json<{ focus: Focus }>('/api/focus', {
    method: 'POST',
    body: JSON.stringify({ kind, minutes }),
  });

export const resetAll = () =>
  json<{ ok: true }>('/api/reset', {
    method: 'POST',
    body: JSON.stringify({ confirm: 'erase everything' }),
  });

/**
 * Send a turn and consume the SSE stream. The server streams `data: {...}` frames;
 * we parse on blank-line boundaries and hand each event to `onEvent`.
 */
export async function streamTurn(
  body: { message?: string; kind?: 'user' | 'session_start' },
  onEvent: (event: ForgeEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const payload = frame
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n');
      if (payload) onEvent(JSON.parse(payload) as ForgeEvent);
      boundary = buffer.indexOf('\n\n');
    }
  }
}
