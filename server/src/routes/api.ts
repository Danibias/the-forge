import express from 'express';
import type Anthropic from '@anthropic-ai/sdk';
import { HAS_API_KEY, MODEL } from '../config.js';
import {
  focusToday,
  logFocus,
  messageCount,
  readLedger,
  readMessages,
  resetEverything,
} from '../db.js';
import { isOnboarded, phaseProgress } from '../ledger.js';
import { describeError, isBusy, runTurn, type ForgeEvent } from '../forge.js';

export const api = express.Router();

/** What the learner is shown in the transcript: text blocks of visible turns. */
function visibleTranscript() {
  return readMessages()
    .filter((m) => !m.hidden)
    .map((m) => {
      const blocks = typeof m.content === 'string' ? [] : m.content;
      const text =
        typeof m.content === 'string'
          ? m.content
          : blocks
              .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
              .map((b) => b.text)
              .join('\n\n');
      return { id: m.id, role: m.role, text, at: m.created_at };
    })
    .filter((m) => m.text.trim().length > 0);
}

api.get('/state', (_req, res) => {
  const ledger = readLedger();
  res.json({
    ready: HAS_API_KEY,
    model: MODEL,
    busy: isBusy(),
    started: messageCount() > 0,
    onboarded: isOnboarded(ledger),
    ledger,
    phase_progress: phaseProgress(ledger),
    focus: focusToday(),
    messages: visibleTranscript(),
  });
});

api.get('/ledger', (_req, res) => {
  res.json({ ledger: readLedger(), focus: focusToday() });
});

/**
 * One turn, streamed as SSE. `kind: "session_start"` sends a hidden turn so Forge
 * opens the session itself (§7 opening / §10 kickoff) instead of waiting to be
 * greeted by a learner who has been away for three weeks.
 */
api.post('/chat', async (req, res) => {
  const body = req.body as { message?: string; kind?: 'user' | 'session_start' };
  const kind = body.kind === 'session_start' ? 'session_start' : 'user';
  const message = (body.message ?? '').trim();

  if (kind === 'user' && message.length === 0) {
    res.status(400).json({ error: 'Empty message.' });
    return;
  }
  if (!HAS_API_KEY) {
    res.status(503).json({ error: 'No ANTHROPIC_API_KEY set. Add one to .env and restart.' });
    return;
  }
  if (isBusy()) {
    res.status(409).json({ error: 'Forge is still answering.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event: ForgeEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Abort on the *response* closing. `req` emits 'close' as soon as the body has
  // been read, which would cancel every turn the moment it started.
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  const text =
    kind === 'session_start'
      ? messageCount() === 0
        ? '[The learner just opened the-forge for the first time. No ledger exists.]'
        : '[The learner opened the-forge to begin a session.]'
      : message;

  try {
    await runTurn({ text, hidden: kind === 'session_start' }, send, abort.signal);
    send({ type: 'done' });
  } catch (error) {
    if (!abort.signal.aborted) {
      send({ type: 'error', message: describeError(error) });
      send({ type: 'done' });
    }
  } finally {
    res.end();
  }
});

api.post('/focus', (req, res) => {
  const { kind, minutes } = req.body as { kind?: string; minutes?: number };
  if (kind !== 'focus' && kind !== 'break') {
    res.status(400).json({ error: 'kind must be "focus" or "break".' });
    return;
  }
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) {
    res.status(400).json({ error: 'minutes must be a positive number.' });
    return;
  }
  logFocus(kind, minutes);
  res.json({ focus: focusToday() });
});

/** Wipes the ledger, the transcript and the focus log. Deliberately explicit. */
api.post('/reset', (req, res) => {
  if ((req.body as { confirm?: string }).confirm !== 'erase everything') {
    res.status(400).json({ error: 'Send {"confirm":"erase everything"} to reset.' });
    return;
  }
  resetEverything();
  res.json({ ok: true });
});
