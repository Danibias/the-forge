import type { Focus, Ledger } from '../types';
import { ConceptMeter } from './ConceptMeter';
import { Pomodoro } from './Pomodoro';

interface Props {
  ledger: Ledger;
  phaseProgress: string | null;
  focus: Focus;
  onFocusLogged: (focus: Focus) => void;
}

export function Dashboard({ ledger, phaseProgress, focus, onFocusLogged }: Props) {
  const locked = ledger.gate.toLowerCase().startsWith('locked');
  const room = ledger.training_room;

  return (
    <aside className="dashboard">
      {/* §8.7 — read cold, possibly weeks later. First thing on the page. */}
      <section className="card pickup">
        <h3>Pick up here</h3>
        {ledger.next_session.first_action ? (
          <>
            <p className="action">{ledger.next_session.first_action}</p>
            {ledger.next_session.target && (
              <p className="meta">target · {ledger.next_session.target}</p>
            )}
            {ledger.next_session.warmup && (
              <p className="meta">warmup · {ledger.next_session.warmup}</p>
            )}
          </>
        ) : (
          <p className="empty">Nothing written yet. Forge fills this in at the end of a session.</p>
        )}
      </section>

      <section className="card">
        <header>
          <h3>{ledger.phase ?? 'No phase yet'}</h3>
          <span className={`gate ${locked ? 'locked' : 'open'}`}>{locked ? 'LOCKED' : 'open'}</span>
        </header>
        <div className="stats">
          <div>
            <span className="n">{ledger.sessions}</span>
            <span className="l">sessions</span>
          </div>
          <div>
            <span className="n">{ledger.mastered}</span>
            <span className="l">at ceiling</span>
          </div>
          <div>
            <span className="n">{Math.round(ledger.hours_logged)}</span>
            <span className="l">hours</span>
          </div>
        </div>
        {locked && <p className="gate-note">{ledger.gate}</p>}
        {(ledger.track || ledger.week) && (
          <p className="meta">
            {[ledger.track, ledger.week && `week ${ledger.week}`, ledger.on_schedule]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
      </section>

      {ledger.exit_criteria.length > 0 && (
        <section className="card">
          <header>
            <h3>Exit criteria</h3>
            <span className="stat">{phaseProgress}</span>
          </header>
          <ul className="criteria">
            {ledger.exit_criteria.map((criterion, i) => (
              <li key={i} className={criterion.met ? 'met' : ''}>
                <span className="box">{criterion.met ? '✓' : ''}</span>
                <span>{criterion.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {room && (
        <section className="card room">
          <header>
            <h3>Training room</h3>
            <span className="stat">{room.progress}/10</span>
          </header>
          <p className="meta">targeting · {room.targeting}</p>
          {room.consecutive_fails > 0 && (
            <p className={`meta${room.consecutive_fails >= 3 ? ' warn' : ''}`}>
              {room.consecutive_fails} consecutive fail{room.consecutive_fails === 1 ? '' : 's'}
            </p>
          )}
        </section>
      )}

      {ledger.active.length > 0 && (
        <section className="card">
          <header>
            <h3>Concepts</h3>
            <span className="stat">level / ceiling</span>
          </header>
          <ul className="concepts">
            {ledger.active.map((entry) => (
              <ConceptMeter key={entry.concept} entry={entry} />
            ))}
          </ul>
        </section>
      )}

      <Pomodoro focus={focus} onLogged={onFocusLogged} />

      {ledger.wins.length > 0 && (
        <section className="card wins">
          <h3>Wins</h3>
          <ul>
            {ledger.wins.map((win, i) => (
              <li key={i}>{win}</li>
            ))}
          </ul>
        </section>
      )}

      {ledger.open_loops.length > 0 && (
        <section className="card">
          <h3>Open loops</h3>
          <ul className="plain">
            {ledger.open_loops.map((loop, i) => (
              <li key={i}>{loop}</li>
            ))}
          </ul>
        </section>
      )}

      {ledger.shipped.length > 0 && (
        <section className="card">
          <h3>Shipped</h3>
          <ul className="plain">
            {ledger.shipped.map((thing, i) => (
              <li key={i}>{thing}</li>
            ))}
          </ul>
        </section>
      )}

      {ledger.goal && (
        <section className="card goal">
          <h3>Goal</h3>
          <p>{ledger.goal}</p>
          {ledger.project && <p className="meta">project · {ledger.project}</p>}
          {ledger.constraint && <p className="meta">constraint · {ledger.constraint}</p>}
        </section>
      )}
    </aside>
  );
}
