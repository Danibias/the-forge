/**
 * Value-shape validation for ledger patches.
 *
 * In the API-backed version this job belonged to the `update_ledger` tool's
 * `input_schema` — the API rejected a malformed call before our code ran.
 * Claude Code writes through the CLI instead, so the schema has to live here.
 *
 * `applyUpdate` only filters key *names*; nothing there inspects element shapes.
 * Without this file a patch like `{"active": [{"concept": "closures",
 * "level": "three"}]}` would be stored verbatim and the dashboard would render
 * nonsense. Errors are returned rather than thrown, and the CLI prints them —
 * a rejected write has to be loud, or the model never learns it failed.
 */

import type { Ledger } from './ledger.js';

type Errors = string[];

const CEILINGS = [3, 4, 5, 'exposure'] as const;
const RUNTIMES = ['agentic+hooks', 'agentic', 'chat'] as const;
const CAPSTONE_STATUS = ['not started', 'in progress', 'passed', 'failed'] as const;
const DESIGN_PACK = ['written before', 'revised after', 'both', 'missing'] as const;
const LAB_VERDICT = ['feasible', 'with changes', 'not feasible', 'unknown'] as const;
const POSED_BY = ['learner', 'you'] as const;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nullableString(errs: Errors, at: string, v: unknown): void {
  if (v !== null && typeof v !== 'string') errs.push(`${at}: expected string or null, got ${kind(v)}`);
}

function requiredString(errs: Errors, at: string, v: unknown): void {
  if (typeof v !== 'string' || v.trim() === '') errs.push(`${at}: expected a non-empty string, got ${kind(v)}`);
}

function integer(errs: Errors, at: string, v: unknown, min: number, max: number): void {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    errs.push(`${at}: expected an integer ${min}-${max}, got ${kind(v)}`);
  }
}

function nullableInteger(errs: Errors, at: string, v: unknown, min: number, max: number): void {
  if (v === null) return;
  integer(errs, at, v, min, max);
}

function boolean(errs: Errors, at: string, v: unknown): void {
  if (typeof v !== 'boolean') errs.push(`${at}: expected true or false, got ${kind(v)}`);
}

function oneOf(errs: Errors, at: string, v: unknown, allowed: readonly unknown[]): void {
  if (!allowed.includes(v)) {
    errs.push(`${at}: expected one of ${allowed.map((a) => JSON.stringify(a)).join(', ')}, got ${kind(v)}`);
  }
}

/** Describes what we actually received, so the message is fixable without guessing. */
function kind(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'nothing';
  if (Array.isArray(v)) return 'an array';
  return `${typeof v} ${JSON.stringify(v)}`;
}

/** Runs `check` over each element, or records that the value was not a list. */
function eachItem(
  errs: Errors,
  key: string,
  v: unknown,
  check: (errs: Errors, at: string, item: Record<string, unknown>) => void,
): void {
  if (!Array.isArray(v)) {
    errs.push(`${key}: expected an array, got ${kind(v)}`);
    return;
  }
  v.forEach((item, i) => {
    const at = `${key}[${i}]`;
    if (!isObject(item)) {
      errs.push(`${at}: expected an object, got ${kind(item)}`);
      return;
    }
    check(errs, at, item);
  });
}

function stringArray(errs: Errors, key: string, v: unknown): void {
  if (!Array.isArray(v)) {
    errs.push(`${key}: expected an array of strings, got ${kind(v)}`);
    return;
  }
  v.forEach((item, i) => requiredString(errs, `${key}[${i}]`, item));
}

/** Field-by-field checks, keyed by ledger field. Only the keys present are run. */
const CHECKS: Record<string, (errs: Errors, key: string, v: unknown) => void> = {
  learner: nullableString,
  goal: nullableString,
  constraint: nullableString,
  project: nullableString,
  metaphor_domain: nullableString,
  started: nullableString,
  runtime: (e, k, v) => {
    if (v === null) return;
    oneOf(e, k, v, RUNTIMES);
  },
  track: nullableString,
  week: nullableString,
  next_consolidation: nullableString,
  phase: nullableString,
  on_schedule: nullableString,
  last_session_mode: nullableString,
  last_active: nullableString,

  gate: (e, k, v) => requiredString(e, k, v),
  sessions: (e, k, v) => integer(e, k, v, 0, 10_000),
  mastered: (e, k, v) => integer(e, k, v, 0, 10_000),
  mastered_concepts: stringArray,
  hours_logged: (e, k, v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      e.push(`${k}: expected a number >= 0, got ${kind(v)}`);
    }
  },

  retired_metaphors: stringArray,
  open_loops: stringArray,
  misconceptions: stringArray,
  shipped: stringArray,
  wins: stringArray,

  exit_criteria: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      requiredString(errs, `${at}.text`, item.text);
      boolean(errs, `${at}.met`, item.met);
    }),

  active: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      requiredString(errs, `${at}.concept`, item.concept);
      integer(errs, `${at}.level`, item.level, 0, 5);
      oneOf(errs, `${at}.ceiling`, item.ceiling, CEILINGS);
      nullableInteger(errs, `${at}.last_seen`, item.last_seen, 0, 10_000);
    }),

  stalls: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      requiredString(errs, `${at}.concept`, item.concept);
      integer(errs, `${at}.resolved_by`, item.resolved_by, 1, 6);
      integer(errs, `${at}.session`, item.session, 0, 10_000);
    }),

  demotions: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      requiredString(errs, `${at}.concept`, item.concept);
      integer(errs, `${at}.from`, item.from, 0, 5);
      integer(errs, `${at}.to`, item.to, 0, 5);
      requiredString(errs, `${at}.reason`, item.reason);
      if (
        typeof item.from === 'number' &&
        typeof item.to === 'number' &&
        item.to >= item.from
      ) {
        errs.push(`${at}: a demotion must drop — from ${item.from} to ${item.to} is not a drop`);
      }
    }),

  capstones: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      integer(errs, `${at}.phase`, item.phase, 0, 100);
      requiredString(errs, `${at}.choice`, item.choice);
      oneOf(errs, `${at}.status`, item.status, CAPSTONE_STATUS);
      if (item.design_pack !== null) oneOf(errs, `${at}.design_pack`, item.design_pack, DESIGN_PACK);
      nullableString(errs, `${at}.plan_vs_built`, item.plan_vs_built);
    }),

  labs: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      requiredString(errs, `${at}.problem`, item.problem);
      oneOf(errs, `${at}.verdict`, item.verdict, LAB_VERDICT);
      oneOf(errs, `${at}.posed_by`, item.posed_by, POSED_BY);
      boolean(errs, `${at}.spike_deleted`, item.spike_deleted);
    }),

  pathways: (e, k, v) =>
    eachItem(e, k, v, (errs, at, item) => {
      requiredString(errs, `${at}.name`, item.name);
      nullableInteger(errs, `${at}.opened_session`, item.opened_session, 0, 10_000);
      nullableString(errs, `${at}.brought_home`, item.brought_home);
    }),

  next_session: (e, k, v) => {
    if (!isObject(v)) {
      e.push(`${k}: expected an object, got ${kind(v)}`);
      return;
    }
    for (const field of ['target', 'first_action', 'warmup']) {
      if (field in v) nullableString(e, `${k}.${field}`, v[field]);
    }
    for (const field of Object.keys(v)) {
      if (!['target', 'first_action', 'warmup'].includes(field)) {
        e.push(`${k}.${field}: not a field of next_session`);
      }
    }
  },

  training_room: (e, k, v) => {
    if (v === null) return; // null closes the room — §3.5
    if (!isObject(v)) {
      e.push(`${k}: expected an object or null, got ${kind(v)}`);
      return;
    }
    if ('targeting' in v) requiredString(e, `${k}.targeting`, v.targeting);
    if ('progress' in v) integer(e, `${k}.progress`, v.progress, 0, 10);
    if ('consecutive_fails' in v) integer(e, `${k}.consecutive_fails`, v.consecutive_fails, 0, 3);
    for (const field of Object.keys(v)) {
      if (!['targeting', 'progress', 'consecutive_fails'].includes(field)) {
        e.push(`${k}.${field}: not a field of training_room`);
      }
    }
  },
};

/**
 * Validates a patch before `applyUpdate` sees it. Returns every problem found,
 * not just the first — one round-trip should be enough to fix the whole write.
 */
export function validatePatch(patch: unknown): Errors {
  if (!isObject(patch)) return [`patch: expected a JSON object, got ${kind(patch)}`];

  const errs: Errors = [];
  const known = new Set(Object.keys(CHECKS));

  for (const [key, value] of Object.entries(patch)) {
    if (!known.has(key)) {
      errs.push(`${key}: not a ledger field — see the §7 schema`);
      continue;
    }
    if (value === undefined) continue;
    CHECKS[key]!(errs, key, value);
  }

  if (Object.keys(patch).length === 0) errs.push('patch: empty — nothing to write');
  return errs;
}

/** Checks a whole ledger read from disk, so a corrupted file is caught on load. */
export function validateLedger(value: unknown): Errors {
  if (!isObject(value)) return [`ledger: expected a JSON object, got ${kind(value)}`];
  const errs: Errors = [];
  for (const [key, v] of Object.entries(value)) {
    if (key in CHECKS && v !== undefined) CHECKS[key]!(errs, key, v);
  }
  return errs;
}

export type { Ledger };
