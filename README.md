# the forge

A long-term full-stack engineering apprenticeship, run by Claude against the
**Forge** operating spec: a mentor that teaches the way of thinking rather than
the syntax, tracks what you have actually demonstrated, and never asks you to
carry your own progress between sessions.

The spec lives at [`server/prompts/forge-system-prompt.md`](server/prompts/forge-system-prompt.md)
— ~13.9k words, section-numbered (§1–§10). Forge runs as a **Claude Code skill**,
so the mentor sits in your terminal with your repo in front of it: it can read the
file you are stuck on, run the failing test, and see the actual error. The ladder
tops out at *debugs*, and that is not a rung you can assess from a pasted snippet.

This repo is the machinery the spec assumes exists: the ledger, its validator and
CLI, and the learner's dashboard.

## What it does

**The session** — `/forge` in Claude Code. Session one runs onboarding (§4) and
produces a plan; every session after opens on the ledger, runs a warmup retrieval
check, and ends with the literal first move of the next one.

**The ledger** — your state, in the §7 schema: mastery level against a ceiling for
every concept, phase and gate, exit criteria, stalls, demotions, capstones, labs,
open loops, misconceptions, wins. It lives at `~/.claude/forge/ledger.json` under
git, so every session leaves a diff.

**The dashboard** — everything §7.1 requires you to be able to see: the next
`first_action` as a pick-up-here card, phase and gate state, concepts at their
ceiling, today's focus minutes and pomodoro count, the phase's exit criteria with
those met, every tracked concept as level-against-ceiling, and the wins list.

**The focus timer** — a 25/5 Pomodoro clock. Completed cycles persist, so "today's
focus" survives a reload and reaches the mentor as context, not pressure.

## Setup

```bash
npm install
npm run setup     # build, install the skill, put forge-ledger on PATH
```

Then add the guard hook to `~/.claude/settings.json` (see
[Ledger integrity](#ledger-integrity)), start the dashboard, and open a session:

```bash
npm run dev       # dashboard on http://localhost:5173
```

In Claude Code, from whatever repo you are working in: **`/forge`**.

There is no API key and no model configuration. The mentor is Claude Code itself,
running on whatever plan you already have.

| Variable | Default | Notes |
| --- | --- | --- |
| `FORGE_HOME` | `~/.claude/forge` | Ledger, focus log, and their git history. |
| `PORT` | `5174` | Dashboard API; Vite proxies to it in dev. |

## Ledger integrity

The ledger is the whole apprenticeship. Four things protect it.

**One writer.** `forge-ledger patch '<json>'` is the only supported write path.
It validates, applies §7's patch semantics, writes atomically, and commits.

**A real schema.** `server/src/validate.ts` checks value shapes — `level` an
integer 0–5, `ceiling` one of `3|4|5|exposure`, `exit_criteria` items
`{text, met}`, a demotion that actually drops. A bad patch is **rejected whole**
with every problem listed, and nothing is written. This file exists because the
API-backed version got this validation free from the `update_ledger` tool's
`input_schema`; moving to a CLI means the schema has to live in code.

**A hook, so the CLI is not optional.** Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Edit|Write|MultiEdit|NotebookEdit",
      "hooks": [{
        "type": "command",
        "command": "<path to this repo>/scripts/guard-ledger.sh"
      }]
    }]
  }
}
```

It denies direct edits of `ledger.json` and points at the CLI. Conventions erode
over months; the harness does not.

**Reads never fail open.** A ledger that will not parse is recovered from the last
commit. It is *never* replaced with an empty one — an empty ledger reads as "no
ledger exists" to §4, and Forge would re-run onboarding straight over your history.
If recovery is impossible the error is raised instead of papered over.

Patch semantics, unchanged from §7: scalars and arrays **replace**; `next_session`
and `training_room` merge field-by-field; `"training_room": null` closes the room;
unknown keys are rejected.

## How it is put together

```
server/
  prompts/forge-system-prompt.md   the spec — §1–§10, verbatim
  prompts/skill-header.md          how the spec is wired up here
  src/ledger.ts                    §7 types, patch semantics, §6 decay
  src/validate.ts                  value-shape schema — the tool schema, in code
  src/cli.ts                       forge-ledger: show / patch
  src/store.ts                     atomic writes, git history, safe reads
  src/render.ts                    the ledger as YAML, in §7's key order
  src/routes/api.ts                /state /ledger /focus
web/
  src/components/Dashboard.tsx     §7.1's surface
  src/components/ConceptMeter.tsx  level against ceiling
  src/components/Pomodoro.tsx      rhythm, never a deadline
scripts/
  install-skill.mjs                header + spec → ~/.claude/skills/forge/SKILL.md
  install-cli.mjs                  forge-ledger → ~/.local/bin
  guard-ledger.sh                  the PreToolUse guard
```

The repo is the source of truth for the skill. Edit `server/prompts/*` and re-run
`npm run install-skill` — never hand-edit the installed `SKILL.md`, or the next
install discards the change.

## Two departures from the spec's schema

- `exit_criteria` is a list of `{text, met}` rather than the `"<n>/<n> exit
  criteria met"` string, because §7.1 requires the dashboard to render each
  criterion with its state. The string form is derived.
- `demotions` splits `"<level> → <level>"` into `from`/`to` so the dashboard does
  not have to parse prose.

Everything else is §7 as written.

## Notes

- One learner per `FORGE_HOME`. No auth, no accounts, no multi-tenancy — this runs
  on your own machine.
- To undo a bad session: `git -C ~/.claude/forge log`, then revert. To start over,
  delete the directory.
- The API-backed implementation — chat UI, SSE, `update_ledger` as a real tool — is
  preserved on the `main` branch's first commit if you ever want it back.
