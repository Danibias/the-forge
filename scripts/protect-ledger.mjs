#!/usr/bin/env node
/**
 * The portable substitute for the PreToolUse hook.
 *
 * Claude Code can be told to deny a write before it happens. Nothing else can,
 * so on every other harness the guard has to live in the filesystem: setting
 * `ledger.json` to mode 0444 makes a naive in-place write fail with EACCES,
 * while `forge-ledger`'s atomic rename still lands (renaming into a directory
 * needs write permission on the *directory*, not on the file being replaced).
 *
 * writeAtomic() copies the existing mode onto its temp file, so the guard
 * survives every subsequent write rather than being disarmed by the first one.
 *
 * This is a guard, not a permission system. Anything that chooses to chmod first
 * can still write — the point is that an agent editing the file by accident hits
 * a hard error instead of quietly corrupting months of history.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const home = process.env.FORGE_HOME
  ? path.resolve(process.env.FORGE_HOME)
  : path.join(os.homedir(), '.claude', 'forge');
const ledger = path.join(home, 'ledger.json');

if (!fs.existsSync(ledger)) {
  console.log(`${ledger} does not exist yet — it is created by session one.`);
  console.log('Re-run this once you have a ledger.');
  process.exit(0);
}

const before = fs.statSync(ledger).mode & 0o777;
if (before === 0o444) {
  console.log(`already protected  ${ledger}  (mode 444)`);
} else {
  fs.chmodSync(ledger, 0o444);
  console.log(`protected  ${ledger}  (mode ${before.toString(8)} -> 444)`);
}
console.log('\nDirect edits now fail with EACCES. forge-ledger patch still works.');
console.log('To undo: chmod 644 ' + ledger);
