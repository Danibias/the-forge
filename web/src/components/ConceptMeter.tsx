import type { ConceptEntry } from '../types';

const LEVEL_NAMES = ['unseen', 'encountered', 'guided', 'independent', 'explains', 'debugs'];

/**
 * Level against ceiling (§6). Five rungs; the ceiling is drawn as a notch so a
 * concept that is *done* reads differently from one that merely scored well.
 */
export function ConceptMeter({ entry }: { entry: ConceptEntry }) {
  const exposure = entry.ceiling === 'exposure';
  const ceiling: number = exposure ? 5 : (entry.ceiling as number);
  const atCeiling = !exposure && entry.level >= ceiling;

  return (
    <li className={`concept${atCeiling ? ' done' : ''}`}>
      <div className="concept-head">
        <span className="name">{entry.concept}</span>
        <span className="level" title={LEVEL_NAMES[entry.level] ?? ''}>
          {entry.level}
          <span className="of">/{exposure ? 'E' : ceiling}</span>
        </span>
      </div>
      <div className="rungs" aria-label={`level ${entry.level} of ${exposure ? 'exposure' : ceiling}`}>
        {[1, 2, 3, 4, 5].map((rung) => (
          <span
            key={rung}
            className={[
              'rung',
              rung <= entry.level ? 'filled' : '',
              !exposure && rung === ceiling ? 'ceiling' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
    </li>
  );
}
