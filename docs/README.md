# docs

Source for the two published artifacts. They are plain HTML: no build step, no
framework, no external assets. Edit the file, then republish it to the URL it
already owns — publishing without the URL creates a *second* artifact rather than
updating the existing one.

| File | Published at | What it is |
| --- | --- | --- |
| [`spec.html`](spec.html) | [c6f9fb4d…](https://claude.ai/code/artifact/c6f9fb4d-bf82-4c7f-b803-fa3ea2115f03) | The §1–§10 operating spec, formatted for reading |
| [`field-manual.html`](field-manual.html) | [1631554a…](https://claude.ai/code/artifact/1631554a-d4ec-4922-b090-7c6b05d7dfb9) | How to set Forge up and run it, English and Spanish |

**These are not the prompt.** The prompt Forge actually runs is built from
`server/prompts/` into `FORGE-PROMPT.md` and `SKILL.md` — see the root README.
`spec.html` is the same §1–§10 material typeset for a human reader, so **a change
to the spec has to be made in both places.** They will drift otherwise, and the
one that matters is `server/prompts/forge-system-prompt.md`, because that is the
one the model reads.

## The field manual is bilingual

Two complete documents in one file: `<div class="wrap" data-lang="en">` and
`data-lang="es"`, with a toggle that defaults to the reader's browser language
and remembers their choice in `localStorage`. Anchors are prefixed `es-` on the
Spanish side so the two contents rails do not collide.

Editing one side means editing the other. There is no fallback — a section added
only in English is simply missing for a Spanish reader.

Technical vocabulary stays in English inside the Spanish text: `ledger`, `gate`,
`capstone`, `runtime`, `wins`, `misconceptions`, `training room`. That is §8.1 of
the spec applied to the docs — the errors and the documentation a learner will
search are in English, so translating the terms would make them harder to look
up, not easier.

## Before publishing

Both pages are public-facing. Check for anything of the author's that crept back
in — a real ledger's numbers, a home directory in a command's output, a project
name. Three separate passes have been needed so far:

```bash
grep -nE 'danibias|career-forge|/home/(?!you|tu-usuario)' -P docs/*.html
```

`/home/you` and `/home/tu-usuario` are the intended placeholders, so the pattern
excludes them; anything else it prints is a real leak.
