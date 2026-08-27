/**
 * `forge-ledger compare <file...>` — several exports, read together.
 *
 * One learner's backlog tells you about that learner. The same backlog appearing
 * in three unrelated learners tells you about the plan, which is the whole reason
 * §3.5 says the record "diagnoses the curriculum, not the learner."
 *
 * So this deliberately leads with what repeats. A stall rung that dominates, a
 * misconception two strangers both arrived at, a phase everyone's backlog swells
 * in — those are edits to make. A number that appears once is a person having a
 * week, and the report says so by not highlighting it.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { ForgeExport } from './export.js';

interface Loaded {
  label: string;
  data: ForgeExport;
}

const RUNG_MEANING: Record<number, string> = {
  1: 're-enter the cycle earlier',
  2: 'replace the metaphor',
  3: 'halve the example',
  4: 'split the concept',
  5: 'check the prerequisite',
  6: 'park it',
};

export function loadExports(files: string[]): Loaded[] {
  return files.map((file) => {
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf8');
    } catch {
      throw new Error(`${file}: cannot read.`);
    }
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${file}: not valid JSON — ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!data || typeof data !== 'object' || (data as ForgeExport).forge_export !== 1) {
      throw new Error(`${file}: not a forge export (missing "forge_export": 1).`);
    }
    return { label: path.basename(file, '.json'), data: data as ForgeExport };
  });
}

/** Normalized enough to match across learners without pretending to be clever. */
function fingerprint(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .join(' ');
}

function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]!) : c.padStart(widths[i]!))).join('  ');
  return [line(headers), widths.map((w) => '-'.repeat(w)).join('  '), ...rows.map(line)].join('\n');
}

export function compareReport(loaded: Loaded[]): string {
  const out: string[] = [];
  const n = loaded.length;

  out.push(`${n} export${n === 1 ? '' : 's'}.\n`);

  // --- where everyone is -----------------------------------------------------
  out.push('PROGRESS');
  out.push(
    table(
      ['learner', 'model', 'runtime', 'sess', 'hours', 'phase', 'crit', 'ceil'],
      loaded.map(({ label, data }) => [
        label,
        data.model,
        data.runtime ?? '?',
        String(data.sessions),
        data.hours_logged.toFixed(0),
        (data.phase ?? '?').slice(0, 22),
        `${data.exit_criteria.met}/${data.exit_criteria.total}`,
        String(data.mastered),
      ]),
    ),
  );

  // --- the backlogs, side by side -------------------------------------------
  out.push('\nBACKLOG');
  out.push(
    table(
      ['learner', 'loops', '/sess', 'unmet', 'below', 'rungs', 'decay', 'caps', 'room'],
      loaded.map(({ label, data }) => {
        const b = data.backlog;
        return [
          label,
          String(b.open_loops),
          b.open_loops_per_session === null ? '-' : b.open_loops_per_session.toFixed(2),
          String(b.exit_criteria_unmet),
          String(b.concepts_below_ceiling),
          String(b.rungs_remaining),
          String(b.decay_due),
          String(b.capstones_outstanding),
          b.training_room_open ? 'open' : '-',
        ];
      }),
    ),
  );
  out.push(
    '\n  rungs = sum of (ceiling - level) still to climb. The honest measure of work left,',
    '  and the one to watch: it should fall between exports, and a learner whose rungs',
    '  climb while sessions climb is being given concepts faster than they can finish them.',
  );

  // --- what repeats ----------------------------------------------------------
  const rungs = new Map<number, number>();
  for (const { data } of loaded) {
    for (const s of data.stalls) rungs.set(s.resolved_by, (rungs.get(s.resolved_by) ?? 0) + 1);
  }
  const totalStalls = [...rungs.values()].reduce((a, b) => a + b, 0);
  if (totalStalls > 0) {
    out.push(`\nSTALLS BY RUNG  (${totalStalls} across ${n})`);
    const rows = [...rungs.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([rung, count]) => [
        `rung ${rung} — ${RUNG_MEANING[rung] ?? '?'}`,
        String(count),
        `${Math.round((count / totalStalls) * 100)}%`,
      ]);
    out.push(table(['resolved by', 'n', 'share'], rows));
    const top = [...rungs.entries()].sort((a, b) => b[1] - a[1])[0]!;
    if (top[1] / totalStalls > 0.4 && totalStalls >= 4) {
      const verdict =
        top[0] >= 5
          ? 'the plan is outrunning its foundations — §3.5 rung 5 keeps being the fix'
          : top[0] <= 3
            ? 'your examples are too big, or the metaphors are not landing'
            : 'concepts are not atomic enough — they keep needing splitting';
      out.push(`\n  ! rung ${top[0]} resolves ${Math.round((top[1] / totalStalls) * 100)}% of stalls: ${verdict}.`);
    }
  }

  // --- misconceptions shared across learners ---------------------------------
  const seen = new Map<string, { text: string; who: Set<string> }>();
  for (const { label, data } of loaded) {
    for (const m of data.misconceptions) {
      const key = fingerprint(m);
      if (key === '') continue;
      const entry = seen.get(key) ?? { text: m, who: new Set<string>() };
      entry.who.add(label);
      seen.set(key, entry);
    }
  }
  const shared = [...seen.values()].filter((e) => e.who.size > 1);
  if (n > 1) {
    out.push(`\nMISCONCEPTIONS IN MORE THAN ONE LEARNER  (${shared.length})`);
    if (shared.length === 0) {
      out.push('  none — with this few exports that is expected, not reassuring.');
    } else {
      for (const e of shared.sort((a, b) => b.who.size - a.who.size)) {
        out.push(`  [${e.who.size}] ${e.text.slice(0, 100)}`);
      }
      out.push(
        '\n  These are the highest-value edits available. A wrong model two strangers both',
        '  reach is a §3.1 metaphor doing damage, and it is fixable in one pass.',
      );
    }
    out.push(
      '\n  Matching is word-overlap on free text, so it is conservative: the same',
      '  misconception written two different ways, or in two languages, will not pair up.',
      '  Treat a hit as a strong signal and a miss as no information — read the full lists.',
    );
  }

  // --- phase cost ------------------------------------------------------------
  const byPhase = new Map<string, number[]>();
  for (const { data } of loaded) {
    if (!data.phase) continue;
    const list = byPhase.get(data.phase) ?? [];
    list.push(data.sessions);
    byPhase.set(data.phase, list);
  }
  if ([...byPhase.values()].some((v) => v.length > 1)) {
    out.push('\nSESSIONS ON REACHING EACH PHASE');
    out.push(
      table(
        ['phase', 'n', 'min', 'max'],
        [...byPhase.entries()]
          .filter(([, v]) => v.length > 1)
          .map(([phase, v]) => [
            phase.slice(0, 30),
            String(v.length),
            String(Math.min(...v)),
            String(Math.max(...v)),
          ]),
      ),
    );
  }

  return out.join('\n');
}
