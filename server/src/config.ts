import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root, whether running from src/ (tsx) or dist/ (node). */
export const ROOT = path.resolve(here, '..', '..');
export const SERVER_ROOT = path.resolve(here, '..');

export const PORT = Number(process.env.PORT ?? 5174);
export const MODEL = process.env.FORGE_MODEL ?? 'claude-opus-5';

const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];
const rawEffort = process.env.FORGE_EFFORT ?? 'high';
export const EFFORT: Effort = (EFFORTS as readonly string[]).includes(rawEffort)
  ? (rawEffort as Effort)
  : 'high';

export const DB_PATH = path.resolve(ROOT, process.env.FORGE_DB ?? './data/forge.db');
export const PROMPT_PATH = path.join(SERVER_ROOT, 'prompts', 'forge-system-prompt.md');
export const WEB_DIST = path.join(ROOT, 'web', 'dist');

export const HAS_API_KEY = Boolean(
  process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
);
