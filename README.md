# the forge

A long-term full-stack engineering apprenticeship, run by Claude against the
**Forge** operating spec: a mentor that teaches the way of thinking rather than
the syntax, tracks what you have actually demonstrated, and never asks you to
carry your own progress between sessions.

The spec lives at [`server/prompts/forge-system-prompt.md`](server/prompts/forge-system-prompt.md)
— ~13.9k words, section-numbered (§1–§10). It is the system prompt, verbatim.
This repo is the application that spec assumes exists: the ledger, the
`update_ledger` tool, and the learner's dashboard.

## What it does

**Chat** — one continuous conversation with Forge. Session one runs onboarding
(§4) and produces a plan; every session after opens on the ledger, runs a warmup
retrieval check, and ends with the literal first move of the next one.

**The ledger** — the learner's state, in the §7 schema: mastery level against a
ceiling for every concept, phase and gate, exit criteria, stalls, demotions,
capstones, labs, open loops, misconceptions, wins. It is read into context on
every turn and written by the model through the `update_ledger` tool. The write
is silent; you see it on the dashboard, never as YAML in chat.

**The dashboard** — everything §7.1 requires the learner to be able to see:
the next `first_action` as a pick-up-here card, phase and gate state, concepts at
their ceiling, today's focus minutes and pomodoro count, the phase's exit criteria
with those met, every tracked concept as level-against-ceiling, and the wins list.

**The focus timer** — a 25/5 Pomodoro clock. Completed cycles persist, so "today's
focus" survives a reload and reaches the model as context, not pressure.

## Running it

```bash
cp .env.example .env      # then put your key in it
npm install
npm run dev               # server on :5174, web on :5173
```

Open <http://localhost:5173> and press **Begin the first session**.

For a single-process build:

```bash
npm run build && npm start   # serves the built SPA from :5174
```

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | Required. Chat refuses without it. |
| `PORT` | `5174` | API + production static server. |
| `FORGE_MODEL` | `claude-opus-5` | |
| `FORGE_EFFORT` | `high` | `low` · `medium` · `high` · `xhigh` · `max` |
| `FORGE_DB` | `./data/forge.db` | SQLite file. Delete it to start over. |

## How it is put together

```
server/
  prompts/forge-system-prompt.md   the spec — the system prompt, byte-stable
  src/prompt.ts                    system blocks: frozen spec + volatile ledger
  src/tools.ts                     update_ledger, the §7 schema as a tool
  src/forge.ts                     stream a turn, run the tool loop, persist
  src/ledger.ts                    ledger types, patch semantics, §6 decay
  src/db.ts                        SQLite (node:sqlite — no native deps)
  src/routes/api.ts                /state /chat (SSE) /ledger /focus /reset
web/
  src/App.tsx                      chat + dashboard, one screen
  src/components/Dashboard.tsx     §7.1's surface
  src/components/ConceptMeter.tsx  level against ceiling
  src/components/Pomodoro.tsx      rhythm, never a deadline
```

**Prompt caching.** The spec is system block 0 with a 1-hour cache breakpoint;
everything that changes turn to turn — the ledger, today's focus, the date —
lives in block 1, after it. Keep it that way: editing block 0 per-request, or
moving anything volatile ahead of the breakpoint, silently drops the cache hit
and pays full price for 80KB on every message.

**Tool loop.** `runTurn` streams the reply, applies any `update_ledger` calls,
appends the tool results, and streams again — up to 8 rounds. The whole turn is
unwound from the database if it fails mid-stream, so the stored history is always
a conversation the API will accept on the next attempt.

**Ledger patches.** Scalars and arrays replace; `next_session` and `training_room`
merge field-by-field; unknown keys are dropped. Arrays replacing wholesale is the
sharp edge — the tool description and the host notes both say so, because a
partial `wins` write would otherwise be a silent delete.

## Two departures from the spec's schema

- `exit_criteria` is a list of `{text, met}` rather than the `"<n>/<n> exit
  criteria met"` string, because §7.1 requires the dashboard to render each
  criterion with its state. The string form is derived.
- `demotions` splits `"<level> → <level>"` into `from`/`to` so the dashboard does
  not have to parse prose.

Everything else is §7 as written.

## Notes

- One learner per database. There is no auth, no accounts, and no multi-tenancy;
  this is meant to run on your own machine.
- `POST /api/reset` with `{"confirm":"erase everything"}` wipes the ledger, the
  transcript and the focus log. There is no undo.
