#!/usr/bin/env node
/**
 * `forge-ledger` — the only supported way to write the ledger.
 *
 * This replaces the `update_ledger` tool from the API-backed version. The point
 * is not convenience: it is that a bad write must *fail loudly*. Editing
 * ledger.json directly succeeds even when the contents are wrong, and nothing
 * tells the mentor it broke anything. Here a rejected patch exits non-zero with
 * the specific problems, which lands in the tool output and can be corrected on
 * the next turn.
 *
 *   forge-ledger show                 read the ledger (YAML, §7 order)
 *   forge-ledger patch '<json>'       validate, apply, commit
 *   echo '<json>' | forge-ledger patch
 *   forge-ledger export               curriculum signal, personal fields withheld
 */

import fs from 'node:fs';
import { applyUpdate } from './ledger.js';
import { focusToday, readLedger, writeLedger, LedgerCorrupt } from './store.js';
import { renderLedger } from './render.js';
import { validatePatch } from './validate.js';
import { buildExport, exportNotice } from './export.js';

const USAGE = `forge-ledger — read and write the apprenticeship ledger

  forge-ledger show               print the ledger (YAML, §7 order)
  forge-ledger show --json        print the raw stored JSON
  forge-ledger patch '<json>'     apply a patch; reads stdin if no argument
  forge-ledger export [model]     print shareable curriculum data (nothing is sent)

Patch semantics (unchanged from §7):
  - send only the fields that changed
  - arrays REPLACE wholesale — send the full list you want to keep
  - next_session and training_room merge field-by-field
  - training_room: null closes the room
`;

function fail(message: string, detail: string[] = []): never {
  process.stderr.write(`${message}\n`);
  for (const line of detail) process.stderr.write(`  - ${line}\n`);
  process.exit(1);
}

/** Reads fd 0 so `echo '<json>' | forge-ledger patch` works. */
function readStdin(): string {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function main(): void {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    process.stdout.write(USAGE);
    return;
  }

  let ledger;
  try {
    ledger = readLedger();
  } catch (error) {
    if (error instanceof LedgerCorrupt) {
      fail(
        `${error.message}\nThe ledger was NOT modified. Fix the file or restore it with 'git -C ~/.claude/forge log'.`,
        error.detail,
      );
    }
    throw error;
  }

  if (command === 'show') {
    if (rest.includes('--json')) {
      process.stdout.write(`${JSON.stringify(ledger, null, 2)}\n`);
      return;
    }
    process.stdout.write(`${renderLedger(ledger, focusToday())}\n`);
    return;
  }

  if (command === 'patch') {
    const source = rest.length > 0 && rest[0] !== '-' ? rest.join(' ') : readStdin();
    if (source.trim() === '') fail('patch: no JSON given (pass it as an argument or on stdin).');

    let patch: unknown;
    try {
      patch = JSON.parse(source);
    } catch (error) {
      fail(`patch: not valid JSON — ${error instanceof Error ? error.message : String(error)}`, [
        'Nothing was written.',
      ]);
    }

    const problems = validatePatch(patch);
    if (problems.length > 0) {
      fail(`patch rejected — ${problems.length} problem(s). Nothing was written.`, problems);
    }

    const fields = Object.keys(patch as object);
    const updated = applyUpdate(ledger, patch);
    writeLedger(updated, `session ${updated.sessions}: ${fields.join(', ')}`);
    process.stdout.write(`ledger updated (${fields.join(', ')})\n`);
    return;
  }

  if (command === 'export') {
    const model = rest.filter((a) => !a.startsWith('-')).join(' ').trim() || 'unspecified';
    process.stderr.write(exportNotice());
    process.stdout.write(`${JSON.stringify(buildExport(ledger, model), null, 2)}\n`);
    return;
  }

  fail(`unknown command '${command}'.\n\n${USAGE}`);
}

main();
