import type Anthropic from '@anthropic-ai/sdk';

const conceptEntry = {
  type: 'object',
  additionalProperties: false,
  required: ['concept', 'level', 'ceiling'],
  properties: {
    concept: { type: 'string' },
    level: { type: 'integer', minimum: 0, maximum: 5 },
    ceiling: { oneOf: [{ enum: [3, 4, 5] }, { const: 'exposure' }] },
    last_seen: {
      type: ['integer', 'null'],
      description: 'Session number this concept was last worked.',
    },
  },
} as const;

/**
 * §7's schema as a tool. Every field is optional: the model sends what changed.
 * Arrays replace wholesale, so a partial array write is a delete — the tool
 * description says so, and so do the host notes in the system prompt.
 */
export const updateLedgerTool: Anthropic.Tool = {
  name: 'update_ledger',
  description: [
    "Persist a change to the learner's ledger (§7). Silent — the learner sees the",
    'result on their dashboard, never in chat.',
    '',
    'Call at the end of every session, and immediately after any level change,',
    'demotion, stall, capstone result, gate transition, or new win. Do not call it',
    'on ordinary conversational turns.',
    '',
    'Send only the fields that changed. Scalars and arrays REPLACE what is stored,',
    'so when you touch an array send the complete list you want kept (all wins, all',
    'active concepts, ...). next_session and training_room merge field-by-field.',
    'Keep the payload lean: prune concepts that reached their ceiling out of',
    '`active` and fold them into the `mastered` count (§7).',
  ].join('\n'),
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      learner: { type: 'string' },
      goal: { type: 'string', description: 'The identity, in their own words (§1).' },
      constraint: {
        type: ['string', 'null'],
        description: 'Date / money / switch. A schedule input, never the goal.',
      },
      project: { type: 'string', description: 'Their one real project.' },
      metaphor_domain: { type: 'string', description: 'cooking / music / logistics / ...' },
      started: { type: 'string', description: 'YYYY-MM-DD.' },
      sessions: { type: 'integer', minimum: 0 },
      hours_logged: { type: 'number', minimum: 0 },

      track: { type: 'string', description: 'standard | intensive 52wk | compressed 28wk' },
      week: { type: 'string', description: 'e.g. "7/52" — scheduled tracks only (§5.4).' },
      next_consolidation: { type: 'string', description: 'e.g. "week 12".' },

      phase: { type: 'string', description: 'e.g. "3 — Data has a shape".' },
      exit_criteria: {
        type: 'array',
        description: "This phase's exit criteria, phrased as tasks, with what is met so far.",
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'met'],
          properties: { text: { type: 'string' }, met: { type: 'boolean' } },
        },
      },
      on_schedule: {
        type: 'string',
        description: 'yes | behind by <n> weeks — cut list applied to step <n>',
      },

      mastered: {
        type: 'integer',
        minimum: 0,
        description: 'Count of concepts that reached their ceiling and left `active`.',
      },
      active: { type: 'array', items: conceptEntry },

      retired_metaphors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Concepts now understood literally (§3.2).',
      },
      open_loops: { type: 'array', items: { type: 'string' } },
      misconceptions: {
        type: 'array',
        items: { type: 'string' },
        description: '"<belief> → corrected session n, watch for relapse"',
      },
      stalls: {
        type: 'array',
        description: 'Diagnoses the plan, not the learner (§3.5).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['concept', 'resolved_by', 'session'],
          properties: {
            concept: { type: 'string' },
            resolved_by: { type: 'integer', minimum: 1, maximum: 6, description: 'Rung 1-6.' },
            session: { type: 'integer' },
          },
        },
      },
      demotions: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['concept', 'from', 'to', 'reason'],
          properties: {
            concept: { type: 'string' },
            from: { type: 'integer', minimum: 0, maximum: 5 },
            to: { type: 'integer', minimum: 0, maximum: 5 },
            reason: { type: 'string', description: 'failed retrieval | stall' },
          },
        },
      },
      capstones: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['phase', 'choice', 'status'],
          properties: {
            phase: { type: 'integer' },
            choice: { type: 'string' },
            status: { enum: ['not started', 'in progress', 'passed', 'failed'] },
            design_pack: { enum: ['written before', 'revised after', 'both', 'missing'] },
            plan_vs_built: {
              type: 'string',
              description: '"<n> changes — <n> they could have foreseen" (§5.9).',
            },
          },
        },
      },

      gate: { type: 'string', description: 'open | LOCKED — phase <n> capstone not passed' },
      training_room: {
        type: ['object', 'null'],
        additionalProperties: false,
        description: 'Present only while a room is open (§5.7). Null closes it.',
        properties: {
          targeting: { type: 'string' },
          progress: { type: 'integer', minimum: 0, maximum: 10 },
          consecutive_fails: { type: 'integer', minimum: 0 },
        },
      },

      shipped: { type: 'array', items: { type: 'string' } },
      pathways: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: { type: 'string' },
            opened_session: { type: ['integer', 'null'] },
            brought_home: { type: ['string', 'null'] },
          },
        },
      },
      wins: {
        type: 'array',
        items: { type: 'string' },
        description: "Concrete things they can do now that they couldn't before (§8.5).",
      },
      last_session_mode: { enum: ['push', 'consolidate', 'play', 'cold check', 'lab'] },
      labs: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['problem', 'verdict'],
          properties: {
            problem: { type: 'string' },
            verdict: { enum: ['feasible', 'with changes', 'not feasible', 'unknown'] },
            posed_by: { enum: ['learner', 'you'] },
            spike_deleted: { type: 'boolean' },
          },
        },
      },

      next_session: {
        type: 'object',
        additionalProperties: false,
        properties: {
          target: { type: 'string', description: 'The one concept or milestone.' },
          first_action: {
            type: 'string',
            description:
              'The literal first move, written to be executed by someone who remembers nothing (§8.7): "open routes/auth.ts and add the 401 branch".',
          },
          warmup: { type: 'string', description: 'Retrieval check on a decaying concept.' },
        },
      },
    },
  },
};

export const TOOLS: Anthropic.Tool[] = [updateLedgerTool];
