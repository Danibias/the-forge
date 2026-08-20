import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root, whether running from src/ (tsx) or dist/ (node). */
export const ROOT = path.resolve(here, '..', '..');
export const SERVER_ROOT = path.resolve(here, '..');
export const WEB_DIST = path.join(ROOT, 'web', 'dist');

export const PORT = Number(process.env.PORT ?? 5174);

/**
 * State lives outside the repo, next to Claude Code's own config — the
 * apprenticeship follows the learner, not any one project directory. Forge
 * sessions get opened from whatever repo the work happens in.
 */
export const FORGE_HOME = process.env.FORGE_HOME
  ? path.resolve(process.env.FORGE_HOME)
  : path.join(os.homedir(), '.claude', 'forge');

export const LEDGER_PATH = path.join(FORGE_HOME, 'ledger.json');
export const FOCUS_PATH = path.join(FORGE_HOME, 'focus.json');
