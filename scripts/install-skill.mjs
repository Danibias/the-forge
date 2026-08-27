#!/usr/bin/env node
/**
 * Builds the two forms of the prompt from the same source.
 *
 *   ~/.claude/skills/forge/SKILL.md   frontmatter + header + spec  (Claude Code)
 *   FORGE-PROMPT.md                   header + spec                (anything else)
 *
 * The second exists so the apprenticeship is not tied to one vendor: it is a
 * plain Markdown file to paste into whatever model the learner has, or to load
 * as a system prompt in any harness. The header is runtime-aware and tells the
 * model which tier it is in, so one file serves both.
 *
 * The repo stays the source of truth. Edit `server/prompts/*` and re-run this —
 * never hand-edit either output, or the next run silently discards the change.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prompts = path.join(root, 'server', 'prompts');

const read = (name) => fs.readFileSync(path.join(prompts, name), 'utf8');
const frontmatter = read('skill-frontmatter.md');
const header = read('prompt-header.md');
const spec = read('forge-system-prompt.md');

const body = `${header.trimEnd()}\n\n${spec.trimStart()}`;
const kb = (file) => `(${(fs.statSync(file).size / 1024).toFixed(1)} KB)`;

// --- the Claude Code skill -------------------------------------------------
const skillDir = path.join(os.homedir(), '.claude', 'skills', 'forge');
fs.mkdirSync(skillDir, { recursive: true });
const skill = path.join(skillDir, 'SKILL.md');
fs.writeFileSync(skill, `${frontmatter.trim()}\n\n${body}`);
console.log(`installed  ${skill}  ${kb(skill)}`);

// --- the portable prompt ---------------------------------------------------
// At the repo root, not in dist/, because dist/ is gitignored and this file is
// the whole point of the portable path: someone should be able to clone (or just
// open the repo on the web) and copy it without building anything.
const portable = path.join(root, 'FORGE-PROMPT.md');
fs.writeFileSync(portable, body);
console.log(`wrote      ${portable}  ${kb(portable)}`);

console.log('\nClaude Code: run /forge to open a session.');
console.log('Any other model: paste FORGE-PROMPT.md as the system prompt, then say "start".');
