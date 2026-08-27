/**
 * `forge-ledger export` — the curriculum signal, without the person.
 *
 * A ledger is a personal document. It carries someone's stated identity, their
 * financial situation, their working hours, and a running record of everything
 * they have got wrong. None of that helps anyone improve the curriculum, and all
 * of it is theirs. So the export drops it.
 *
 * What is left is what §3.5 already says the record is *for*: "this record
 * diagnoses the curriculum, not the learner." Stalls and the rung that resolved
 * them, demotions, misconceptions that recur, how long phases actually took,
 * which capstones failed — read across several learners, that is the evidence
 * for changing the plan. Read across one, it is the evidence for changing that
 * learner's plan. Same data, different n.
 *
 * Nothing here transmits anything. It writes to stdout. Sending it is a separate,
 * deliberate act by the person whose ledger it is.
 */

import { decaying, type Ledger } from './ledger.js';

/** Fields dropped outright: they describe the person, not the programme. */
const WITHHELD = [
  'learner',
  'goal',
  'constraint',
  'project',
  'metaphor_domain',
  'wins',
  'next_session',
  'last_active',
] as const;

/**
 * Open loops are a backlog, which makes them worth comparing — and they are also
 * free text about someone's own project, which makes them theirs. So the shape
 * of the backlog always ships and the text of it never does unless asked for.
 */
const OPT_IN = 'open_loops (text)';

/**
 * Fields kept because they are the signal, but which are free text the learner
 * wrote — so they get named in the header for review before anything is sent.
 */
const REVIEW = ['phase', 'concept names', 'misconceptions', 'stalls', 'demotions'] as const;

/**
 * What is still outstanding, as numbers rather than prose. Comparable across
 * learners without carrying a word anyone wrote.
 */
export interface Backlog {
  open_loops: number;
  open_loops_per_session: number | null;
  exit_criteria_unmet: number;
  concepts_below_ceiling: number;
  /** Sum of (ceiling - level) over ceilinged concepts: the work actually left. */
  rungs_remaining: number;
  /** `exposure` concepts never exit rotation, so they are counted apart. */
  exposure_concepts: number;
  decay_due: number;
  capstones_outstanding: number;
  training_room_open: boolean;
}

export interface ForgeExport {
  forge_export: 1;
  generated: string;
  runtime: string | null;
  model: string;
  track: string | null;
  week: string | null;
  sessions: number;
  hours_logged: number;
  phase: string | null;
  on_schedule: string | null;
  gate: string;
  exit_criteria: { total: number; met: number };
  mastered: number;
  mastered_concepts: string[];
  active: { concept: string; level: number; ceiling: number | string; sessions_since_seen: number | null }[];
  retired_metaphors: string[];
  misconceptions: string[];
  stalls: { concept: string; resolved_by: number; session: number }[];
  demotions: { concept: string; from: number; to: number; reason: string }[];
  capstones: { phase: number; status: string; design_pack: string | null; plan_vs_built: string | null }[];
  training_room: { progress: number; consecutive_fails: number } | null;
  labs: { verdict: string; posed_by: string; spike_deleted: boolean }[];
  backlog: Backlog;
  open_loops?: string[];
  pathways: { name: string; opened_session: number | null }[];
  last_session_mode: string | null;
}

function buildBacklog(ledger: Ledger): Backlog {
  const ceilinged = ledger.active.filter((c) => typeof c.ceiling === 'number');
  return {
    open_loops: ledger.open_loops.length,
    open_loops_per_session:
      ledger.sessions > 0
        ? Number((ledger.open_loops.length / ledger.sessions).toFixed(2))
        : null,
    exit_criteria_unmet: ledger.exit_criteria.filter((c) => !c.met).length,
    concepts_below_ceiling: ceilinged.filter((c) => c.level < (c.ceiling as number)).length,
    rungs_remaining: ceilinged.reduce(
      (sum, c) => sum + Math.max(0, (c.ceiling as number) - c.level),
      0,
    ),
    exposure_concepts: ledger.active.length - ceilinged.length,
    decay_due: decaying(ledger).length,
    capstones_outstanding: ledger.capstones.filter((c) => c.status !== 'passed').length,
    training_room_open: ledger.training_room !== null,
  };
}

export function buildExport(ledger: Ledger, model: string, openLoops = false): ForgeExport {
  return {
    forge_export: 1,
    generated: new Date().toISOString().slice(0, 10),
    runtime: ledger.runtime,
    model,
    track: ledger.track,
    week: ledger.week,
    sessions: ledger.sessions,
    hours_logged: ledger.hours_logged,
    phase: ledger.phase,
    on_schedule: ledger.on_schedule,
    gate: ledger.gate,
    exit_criteria: {
      total: ledger.exit_criteria.length,
      met: ledger.exit_criteria.filter((c) => c.met).length,
    },
    mastered: ledger.mastered,
    mastered_concepts: ledger.mastered_concepts,
    // last_seen becomes a distance, so the number cannot be joined against
    // anything else to place this learner on a calendar.
    active: ledger.active.map((c) => ({
      concept: c.concept,
      level: c.level,
      ceiling: c.ceiling,
      sessions_since_seen: c.last_seen === null ? null : ledger.sessions - c.last_seen,
    })),
    retired_metaphors: ledger.retired_metaphors,
    misconceptions: ledger.misconceptions,
    stalls: ledger.stalls,
    demotions: ledger.demotions,
    // The capstone `choice` is kept out: which option someone picked says more
    // about them than about whether the option works.
    capstones: ledger.capstones.map((c) => ({
      phase: c.phase,
      status: c.status,
      design_pack: c.design_pack,
      plan_vs_built: c.plan_vs_built,
    })),
    // `targeting` names the specific thing they failed, in their own words.
    training_room: ledger.training_room
      ? {
          progress: ledger.training_room.progress,
          consecutive_fails: ledger.training_room.consecutive_fails,
        }
      : null,
    // The problem statement is dropped; the verdict mix is the signal (§5.8).
    labs: ledger.labs.map((l) => ({
      verdict: l.verdict,
      posed_by: l.posed_by,
      spike_deleted: l.spike_deleted,
    })),
    pathways: ledger.pathways.map((p) => ({ name: p.name, opened_session: p.opened_session })),
    last_session_mode: ledger.last_session_mode,
    backlog: buildBacklog(ledger),
    ...(openLoops ? { open_loops: ledger.open_loops } : {}),
  };
}

/** Printed to stderr, so it is read by a person and not captured by a pipe. */
export function exportNotice(openLoops: boolean): string {
  return [
    'This is your data and sending it is entirely your choice.',
    '',
    `Withheld automatically: ${WITHHELD.join(', ')}.`,
    `Kept, and written by you — read these before sending: ${REVIEW.join(', ')}.`,
    openLoops
      ? `Included because you passed --open-loops: ${OPT_IN}.`
      : `Withheld unless you pass --open-loops: ${OPT_IN}. The backlog counts ship either way.`,
    '',
    'Nothing has been transmitted. This was printed, not uploaded.',
    '',
  ].join('\n');
}
