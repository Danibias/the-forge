import fs from 'node:fs';
import YAML from 'yaml';
import { PROMPT_PATH } from './config.js';
import { decaying, isOnboarded, phaseProgress, type Ledger } from './ledger.js';

/**
 * The spec itself, read once at boot. This is the cached prefix — it must be
 * byte-stable across requests or prompt caching silently stops paying off.
 */
export const FORGE_SPEC = fs.readFileSync(PROMPT_PATH, 'utf8');

/** Rules that belong to this application rather than to the spec. */
const HOST_NOTES = `
---

# Host application notes

You are running inside **the-forge**, the application §7 refers to. Concretely:

- The learner's ledger is rendered below, freshly read from the database on every
  turn. Treat it as fact (§7). It is *not* part of the conversation — the learner
  cannot see this block, but they can see everything in it on their dashboard.
- **\`update_ledger\`** is a real tool. Call it exactly as §7 describes: at the end
  of every session, and immediately after any level change, demotion, stall,
  capstone result, gate transition, or new win. Not on ordinary turns. Send only
  the fields that changed. The write is silent — never restate the ledger in chat,
  and never announce that you saved it.
- Arrays you send **replace** the stored array wholesale, so send the full list you
  want to persist (e.g. all wins, not just the new one). \`next_session\` and
  \`training_room\` merge field-by-field.
- \`exit_criteria\` is the phase's exit criteria as a list of \`{text, met}\`.
  Write it when a phase opens, and flip \`met\` as each is demonstrated — the
  dashboard renders them, so "\`<n>/<n>\` met" from §7 is derived, not stored.
- The dashboard continuously renders: \`next_session.first_action\` as the
  pick-up-here card, phase and gate, the mastered count, today's focus minutes and
  pomodoro count, exit criteria, every concept in \`active\` as level-against-ceiling,
  and \`wins\`. §7.1 applies — do not recite any of it.
- The focus timer is a Pomodoro clock the learner drives. You can see today's totals
  below; use them per §7.1 (rhythm, never pressure).
- Markdown renders in chat, including fenced code blocks. Use them for code.
`.trim();

function renderLedger(ledger: Ledger, focus: { minutes: number; pomodoros: number }): string {
  if (!isOnboarded(ledger)) {
    return [
      '# Ledger',
      '',
      'No ledger exists. This is the first session — run onboarding (§4), opening as §10 directs.',
    ].join('\n');
  }

  const due = decaying(ledger);
  // Built key-by-key so the YAML the model reads keeps §7's order.
  const view = {
    learner: ledger.learner,
    goal: ledger.goal,
    constraint: ledger.constraint,
    project: ledger.project,
    metaphor_domain: ledger.metaphor_domain,
    started: ledger.started,
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
    '# Ledger',
    '',
    '```yaml',
    YAML.stringify(view, { lineWidth: 0 }).trimEnd(),
    '```',
    '',
    `Today's focus: ${focus.minutes} min across ${focus.pomodoros} pomodoro${focus.pomodoros === 1 ? '' : 's'}.`,
  ];

  if (due.length > 0) {
    lines.push(
      '',
      `Decay check due (§6 — level ≥3, untouched 3+ sessions): ${due
        .map((c) => c.concept)
        .join(', ')}.`,
    );
  }
  return lines.join('\n');
}

/**
 * System blocks. Block 0 is the frozen spec and carries the cache breakpoint;
 * everything volatile lives in block 1, after it, so the cache survives.
 */
export function systemBlocks(
  ledger: Ledger,
  focus: { minutes: number; pomodoros: number },
): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '1h' } }> {
  return [
    { type: 'text', text: FORGE_SPEC, cache_control: { type: 'ephemeral', ttl: '1h' } },
    {
      type: 'text',
      text: `${HOST_NOTES}\n\n${renderLedger(ledger, focus)}\n\nToday is ${new Date().toISOString().slice(0, 10)}.`,
    },
  ];
}
