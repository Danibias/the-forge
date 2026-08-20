import express from 'express';
import { isOnboarded, phaseProgress } from '../ledger.js';
import { focusToday, logFocus, readLedger, LedgerCorrupt } from '../store.js';

export const api = express.Router();

/**
 * Everything the dashboard renders, in one read. The conversation itself lives
 * in Claude Code, so there is no transcript here — this server's whole job is to
 * show the ledger while the session runs in the terminal beside it.
 */
api.get('/state', (_req, res) => {
  try {
    const ledger = readLedger();
    res.json({
      ledger,
      onboarded: isOnboarded(ledger),
      phase_progress: phaseProgress(ledger),
      focus: focusToday(),
    });
  } catch (error) {
    if (error instanceof LedgerCorrupt) {
      res.status(500).json({ error: error.message, detail: error.detail });
      return;
    }
    throw error;
  }
});

api.get('/ledger', (_req, res) => {
  res.json({ ledger: readLedger(), focus: focusToday() });
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
