/**
 * Renders the ledger for reading. Keys are emitted in §7's order rather than
 * whatever order the JSON happens to hold, so the view matches the spec the
 * mentor is working from.
 */

import YAML from 'yaml';
import { decaying, isOnboarded, phaseProgress, type Ledger } from './ledger.js';
import type { FocusToday } from './store.js';

export function renderLedger(ledger: Ledger, focus: FocusToday): string {
  if (!isOnboarded(ledger)) {
    return 'No ledger exists. This is the first session — run onboarding (§4), opening as §10 directs.';
  }

  const view = {
    learner: ledger.learner,
    goal: ledger.goal,
    constraint: ledger.constraint,
    project: ledger.project,
    metaphor_domain: ledger.metaphor_domain,
    started: ledger.started,
    runtime: ledger.runtime ?? 'unrecorded — establish it (§1.1) and write it',
    sessions: ledger.sessions,
    hours_logged: ledger.hours_logged,
    track: ledger.track,
    week: ledger.week,
    next_consolidation: ledger.next_consolidation,
    phase: ledger.phase,
    phase_progress: phaseProgress(ledger),
    exit_criteria: ledger.exit_criteria.map((c) => `[${c.met ? 'x' : ' '}] ${c.text}`),
    on_schedule: ledger.on_schedule,
    mastered: ledger.mastered,
    mastered_concepts: ledger.mastered_concepts,
    active: ledger.active.map((c) => ({
      concept: c.concept,
      level: c.level,
      ceiling: c.ceiling,
      last_seen: c.last_seen === null ? 'never' : `session ${c.last_seen}`,
    })),
    retired_metaphors: ledger.retired_metaphors,
    open_loops: ledger.open_loops,
    misconceptions: ledger.misconceptions,
    stalls: ledger.stalls,
    demotions: ledger.demotions,
    capstones: ledger.capstones,
    gate: ledger.gate,
    training_room: ledger.training_room ?? undefined,
    shipped: ledger.shipped,
    pathways: ledger.pathways,
    wins: ledger.wins,
    last_session_mode: ledger.last_session_mode,
    labs: ledger.labs,
    last_active: ledger.last_active,
    next_session: ledger.next_session,
  };

  const lines = [
    YAML.stringify(view, { lineWidth: 0 }).trimEnd(),
    '',
    `Today's focus: ${focus.minutes} min across ${focus.pomodoros} pomodoro${focus.pomodoros === 1 ? '' : 's'}.`,
  ];

  const due = decaying(ledger);
  if (due.length > 0) {
    lines.push(
      '',
      `Decay check due (§6 — level >= 3, untouched 3+ sessions): ${due.map((c) => c.concept).join(', ')}.`,
    );
  }
  return lines.join('\n');
}
