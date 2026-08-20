#!/usr/bin/env node
/**
 * Installs the Forge skill into ~/.claude/skills/forge/SKILL.md.
 *
 * The repo stays the source of truth: SKILL.md is header + spec, concatenated.
 * Edit `server/prompts/*` and re-run this — never hand-edit the installed copy,
 * or the next run silently discards the change.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prompts = path.join(root, 'server', 'prompts');

const header = fs.readFileSync(path.join(prompts, 'skill-header.md'), 'utf8');
const spec = fs.readFileSync(path.join(prompts, 'forge-system-prompt.md'), 'utf8');

const target = path.join(os.homedir(), '.claude', 'skills', 'forge');
fs.mkdirSync(target, { recursive: true });

const out = path.join(target, 'SKILL.md');
fs.writeFileSync(out, `${header.trimEnd()}\n\n${spec.trimStart()}`);

const bytes = fs.statSync(out).size;
console.log(`installed  ${out}  (${(bytes / 1024).toFixed(1)} KB)`);
console.log('run /forge in Claude Code to open a session.');
