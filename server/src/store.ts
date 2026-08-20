/**
 * Ledger and focus-log persistence.
 *
 * Plain JSON in `~/.claude/forge`, under git. Two properties matter more than
 * the storage format:
 *
 *   1. Writes are atomic — temp file, then rename. A crash mid-write leaves the
 *      previous ledger intact rather than a truncated one.
 *   2. Reads never fail open. A ledger that will not parse is recovered from the
 *      last good commit; it is *not* replaced with an empty one. An empty ledger
 *      reads as "no ledger exists" to §4, and Forge would re-run onboarding
 *      straight over months of history.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FOCUS_PATH, FORGE_HOME, LEDGER_PATH } from './config.js';
import { emptyLedger, type Ledger } from './ledger.js';
import { validateLedger } from './validate.js';

export interface FocusEntry {
  kind: 'focus' | 'break';
  minutes: number;
  at: string; // ISO timestamp
}

export interface FocusToday {
  minutes: number;
  pomodoros: number;
}

function ensureHome(): void {
  fs.mkdirSync(FORGE_HOME, { recursive: true });
}

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: FORGE_HOME, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** The state directory is its own repo, so every ledger write leaves a diff. */
function ensureRepo(): void {
  ensureHome();
  if (fs.existsSync(path.join(FORGE_HOME, '.git'))) return;
  git(['init', '--quiet']);
  git(['config', 'user.name', 'Forge']);
  git(['config', 'user.email', 'forge@localhost']);
}

function writeAtomic(file: string, contents: string): void {
  ensureHome();
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeFileSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/** The most recent committed ledger, or null if there is no usable history. */
function lastCommitted(): Ledger | null {
  const raw = git(['show', 'HEAD:ledger.json']);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (validateLedger(parsed).length > 0) return null;
    return { ...emptyLedger(), ...(parsed as Partial<Ledger>) };
  } catch {
    return null;
  }
}

export class LedgerCorrupt extends Error {
  constructor(
    message: string,
    readonly detail: string[],
  ) {
    super(message);
    this.name = 'LedgerCorrupt';
  }
}

/**
 * Reads the ledger. A missing file means a genuine first run and yields an empty
 * ledger; a *broken* file is recovered from git, and if that fails too the error
 * is raised rather than papered over.
 */
export function readLedger(): Ledger {
  if (!fs.existsSync(LEDGER_PATH)) return emptyLedger();

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch (error) {
    const recovered = lastCommitted();
    if (recovered) return recovered;
    throw new LedgerCorrupt(`${LEDGER_PATH} is not valid JSON and no committed version exists.`, [
      error instanceof Error ? error.message : String(error),
    ]);
  }

  const problems = validateLedger(parsed);
  if (problems.length > 0) {
    const recovered = lastCommitted();
    if (recovered) return recovered;
    throw new LedgerCorrupt(`${LEDGER_PATH} does not match the §7 schema.`, problems);
  }

  // Merged over the template so a ledger written by an older version still loads.
  return { ...emptyLedger(), ...(parsed as Partial<Ledger>) };
}

/** Persists the ledger and commits it. `note` becomes the commit subject. */
export function writeLedger(ledger: Ledger, note: string): void {
  ensureRepo();
  writeAtomic(LEDGER_PATH, `${JSON.stringify(ledger, null, 2)}\n`);
  git(['add', 'ledger.json']);
  git(['commit', '--quiet', '--allow-empty-message', '-m', note]);
}

function readFocus(): FocusEntry[] {
  if (!fs.existsSync(FOCUS_PATH)) return [];
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(FOCUS_PATH, 'utf8'));
    return Array.isArray(parsed) ? (parsed as FocusEntry[]) : [];
  } catch {
    return []; // The focus log is disposable — losing it costs nothing.
  }
}

export function logFocus(kind: 'focus' | 'break', minutes: number): void {
  const entries = readFocus();
  entries.push({ kind, minutes, at: new Date().toISOString() });
  writeAtomic(FOCUS_PATH, `${JSON.stringify(entries, null, 2)}\n`);
}

/** Today's totals. Completed focus blocks only — breaks are not the work (§7.1). */
export function focusToday(): FocusToday {
  const today = new Date().toISOString().slice(0, 10);
  const todays = readFocus().filter((e) => e.kind === 'focus' && e.at.slice(0, 10) === today);
  return {
    minutes: todays.reduce((sum, e) => sum + e.minutes, 0),
    pomodoros: todays.length,
  };
}
