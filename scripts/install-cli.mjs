#!/usr/bin/env node
/**
 * Puts `forge-ledger` on PATH as a wrapper around this checkout's dist/cli.js.
 *
 * A wrapper rather than `npm link` on purpose: no global install, no permissions,
 * and the path is visible in one readable file if it ever needs fixing.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'server', 'dist', 'cli.js');

if (!fs.existsSync(entry)) {
  console.error(`${entry} is missing — run 'npm run build' first.`);
  process.exit(1);
}

const binDir = path.join(os.homedir(), '.local', 'bin');
fs.mkdirSync(binDir, { recursive: true });

const target = path.join(binDir, 'forge-ledger');
fs.writeFileSync(
  target,
  `#!/usr/bin/env bash\n# Wrapper so Forge can call the ledger CLI by name from any directory.\nexec node ${JSON.stringify(entry)} "$@"\n`,
);
fs.chmodSync(target, 0o755);

console.log(`installed  ${target}`);
if (!(process.env.PATH ?? '').split(path.delimiter).includes(binDir)) {
  console.warn(`!  ${binDir} is not on PATH — add it, or the skill cannot call forge-ledger.`);
}
