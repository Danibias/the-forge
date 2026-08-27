/**
 * The ledger is the learner's state. It is the schema from §7 of the Forge spec,
 * stored as JSON and rendered to YAML when it goes into the model's context.
 *
 * Two deliberate departures from the spec's literal YAML:
 *   - `exit_criteria` is a structured list rather than the "<n>/<n> exit criteria met"
 *     string, because §7.1 requires the dashboard to render each criterion with its
 *     met/unmet state. The string form is derived for display.
 *   - `demotions` splits "<level> → <level>" into `from`/`to` so the dashboard can
 *     render the drop without parsing prose.
 */

/**
 * Which harness Forge is running in. It decides what can be assessed (§1.1) and
 * how the ledger moves, so it is recorded rather than re-guessed every session.
 *
 *   agentic+hooks — shell, files, and a pre-write hook guarding the ledger
 *   agentic       — shell and files, no hook; the guard is the file mode instead
 *   chat          — text only; the learner carries the ledger by hand
 */
export type Runtime = 'agentic+hooks' | 'agentic' | 'chat';

export type Ceiling = 3 | 4 | 5 | 'exposure';

export interface ConceptEntry {
  concept: string;
  level: number; // 0-5
  ceiling: Ceiling;
  last_seen: number | null; // session number
}

export interface ExitCriterion {
  text: string;
  met: boolean;
}

export interface Capstone {
  phase: number;
  choice: string;
  status: 'not started' | 'in progress' | 'passed' | 'failed';
  design_pack: 'written before' | 'revised after' | 'both' | 'missing' | null;
  plan_vs_built: string | null;
}

export interface TrainingRoom {
  targeting: string;
  progress: number; // n of 10
  consecutive_fails: number; // 3 => stop, §3.5 rung 5
}

export interface Stall {
  concept: string;
  resolved_by: number; // rung 1-6
  session: number;
}

export interface Demotion {
  concept: string;
  from: number;
  to: number;
  reason: string;
}

export interface Lab {
  problem: string;
  verdict: 'feasible' | 'with changes' | 'not feasible' | 'unknown';
  posed_by: 'learner' | 'you';
  spike_deleted: boolean;
}

export interface Pathway {
  name: string;
  opened_session: number | null;
  brought_home: string | null;
}

export interface NextSession {
  target: string | null;
  first_action: string | null;
  warmup: string | null;
}

export interface Ledger {
  learner: string | null;
  goal: string | null;
  constraint: string | null;
  project: string | null;
  metaphor_domain: string | null;
  started: string | null;
  runtime: Runtime | null;
  sessions: number;
  hours_logged: number;

  track: string | null;
  week: string | null;
  next_consolidation: string | null;

  phase: string | null;
  exit_criteria: ExitCriterion[];
  on_schedule: string | null;

  /**
    * How many concepts have reached their ceiling, and which ones. The count is
    * what §7 asks for; the names exist because pruning to a bare number loses
    * the information two rules depend on — §3.1's "stop scheduling a concept at
    * its ceiling" cannot be checked against a number, and §5.4's cold check
    * draws precisely from concepts no longer in `active`.
    */
  mastered: number;
  mastered_concepts: string[];
  active: ConceptEntry[];

  retired_metaphors: string[];
  open_loops: string[];
  misconceptions: string[];
  stalls: Stall[];
  demotions: Demotion[];
  capstones: Capstone[];

  gate: string;
  training_room: TrainingRoom | null;

  shipped: string[];
  pathways: Pathway[];
  wins: string[];
  last_session_mode: string | null;
  labs: Lab[];
  last_active: string | null;

  next_session: NextSession;
}

export function emptyLedger(): Ledger {
  return {
    learner: null,
    goal: null,
    constraint: null,
    project: null,
    metaphor_domain: null,
    started: null,
    runtime: null,
    sessions: 0,
    hours_logged: 0,
    track: null,
    week: null,
    next_consolidation: null,
    phase: null,
    exit_criteria: [],
    on_schedule: null,
    mastered: 0,
    mastered_concepts: [],
    active: [],
    retired_metaphors: [],
    open_loops: [],
    misconceptions: [],
    stalls: [],
    demotions: [],
    capstones: [],
    gate: 'open',
    training_room: null,
    shipped: [],
    pathways: [],
    wins: [],
    last_session_mode: null,
    labs: [],
    last_active: null,
    next_session: { target: null, first_action: null, warmup: null },
  };
}

/** A ledger is "present" once onboarding (§4) has produced something to read. */
export function isOnboarded(l: Ledger): boolean {
  return Boolean(l.learner || l.goal || l.project || l.phase);
}

const ARRAY_KEYS = new Set([
  'exit_criteria',
  'mastered_concepts',
  'active',
  'retired_metaphors',
  'open_loops',
  'misconceptions',
  'stalls',
  'demotions',
  'capstones',
  'shipped',
  'pathways',
  'labs',
  'wins',
]);

/**
 * Apply an `update_ledger` payload. Scalars and arrays replace; `next_session` and
 * `training_room` merge field-by-field so a partial write does not blank the rest.
 * Unknown keys are dropped — the model does not get to invent schema.
 */
export function applyUpdate(current: Ledger, patch: unknown): Ledger {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return current;
  const next: Ledger = { ...current };
  const template = emptyLedger() as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (!(key in template) || value === undefined) continue;

    if (ARRAY_KEYS.has(key)) {
      if (Array.isArray(value)) (next as unknown as Record<string, unknown>)[key] = value;
      continue;
    }

    if (key === 'next_session' && value && typeof value === 'object') {
      next.next_session = { ...current.next_session, ...(value as Partial<NextSession>) };
      continue;
    }

    if (key === 'training_room') {
      next.training_room =
        value === null
          ? null
          : ({ ...(current.training_room ?? {}), ...(value as object) } as TrainingRoom);
      continue;
    }

    (next as unknown as Record<string, unknown>)[key] = value;
  }

  next.last_active = new Date().toISOString().slice(0, 10);
  return next;
}

/** "2/4 exit criteria met" — the §7 string form, derived rather than stored. */
export function phaseProgress(l: Ledger): string | null {
  if (l.exit_criteria.length === 0) return null;
  const met = l.exit_criteria.filter((c) => c.met).length;
  return `${met}/${l.exit_criteria.length} exit criteria met`;
}

/** Concepts at level >= 3 untouched for 3+ sessions are due a retrieval check (§6). */
export function decaying(l: Ledger): ConceptEntry[] {
  return l.active.filter(
    (c) => c.level >= 3 && c.last_seen !== null && l.sessions - c.last_seen >= 3,
  );
}
