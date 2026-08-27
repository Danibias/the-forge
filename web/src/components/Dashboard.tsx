import { useState } from "react";
import type { Focus, FocusDay, Ledger } from "../types";
import { ConceptMeter } from "./ConceptMeter";
import { Pomodoro } from "./Pomodoro";
import { Streak } from "./Streak";

interface Props {
  ledger: Ledger;
  phaseProgress: string | null;
  focus: Focus;
  week: FocusDay[];
  onFocusLogged: (focus: Focus, week: FocusDay[]) => void;
}

// Fixed count rather than a measured fit: predictable page breaks beat a
// height computation that reflows every time a card next to it changes.
const WINS_PAGE_SIZE = 6;

export function Dashboard({
  ledger,
  phaseProgress,
  focus,
  week,
  onFocusLogged,
}: Props) {
  const locked = ledger.gate.toLowerCase().startsWith("locked");
  const room = ledger.training_room;

  const winsPageCount = Math.max(
    1,
    Math.ceil(ledger.wins.length / WINS_PAGE_SIZE),
  );
  // Default to the last page: wins are appended chronologically, so the
  // most recent ones — what the learner actually wants to see — live there.
  const [winsPage, setWinsPage] = useState(() => winsPageCount - 1);
  const currentWinsPage = Math.min(winsPage, winsPageCount - 1);
  const pagedWins = ledger.wins.slice(
    currentWinsPage * WINS_PAGE_SIZE,
    currentWinsPage * WINS_PAGE_SIZE + WINS_PAGE_SIZE,
  );

  // ledger.hours_logged only updates when Forge patches the ledger at
  // session end; today's pomodoro minutes are live, so add them in here
  // rather than waiting for the next patch to reflect time already spent.
  const liveHours = ledger.hours_logged + focus.minutes / 60;

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
            {ledger.next_session.when && (
              <p className="meta">next · {ledger.next_session.when}</p>
            )}
          </>
        ) : (
          <p className="empty">
            Nothing written yet. Forge fills this in at the end of a session.
          </p>
        )}
      </section>

      {/* Three regions: two side panels flank the wins list, which is the
          main screen — the running record of what actually got proven. */}
      <div className="board">
        <div className="panel panel-left">
          <section className="card">
            <header>
              <h3>{ledger.phase ?? "No phase yet"}</h3>
              <span className={`gate ${locked ? "locked" : "open"}`}>
                {locked ? "LOCKED" : "open"}
              </span>
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
                <span className="n">{liveHours.toFixed(1)}</span>
                <span className="l">hours</span>
              </div>
            </div>
            {locked && <p className="gate-note">{ledger.gate}</p>}
            {(ledger.track || ledger.week) && (
              <p className="meta">
                {[
                  ledger.track,
                  ledger.week && `week ${ledger.week}`,
                  ledger.on_schedule,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </section>

          <Streak week={week} />

          {ledger.exit_criteria.length > 0 && (
            <section className="card">
              <header>
                <h3>Exit criteria</h3>
                <span className="stat">{phaseProgress}</span>
              </header>
              <ul className="criteria">
                {ledger.exit_criteria.map((criterion, i) => (
                  <li key={i} className={criterion.met ? "met" : ""}>
                    <span className="box">{criterion.met ? "✓" : ""}</span>
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
                <p
                  className={`meta${room.consecutive_fails >= 3 ? " warn" : ""}`}
                >
                  {room.consecutive_fails} consecutive fail
                  {room.consecutive_fails === 1 ? "" : "s"}
                </p>
              )}
            </section>
          )}

          {ledger.goal && (
            <section className="card goal">
              <h3>Goal</h3>
              <p>{ledger.goal}</p>
              {ledger.project && (
                <p className="meta">project · {ledger.project}</p>
              )}
              {ledger.constraint && (
                <p className="meta">constraint · {ledger.constraint}</p>
              )}
            </section>
          )}
        </div>

        <main className="panel-main">
          <section className="card wins wins-main">
            <h3>Wins</h3>
            {ledger.wins.length > 0 ? (
              <>
                <ul>
                  {pagedWins.map((win, i) => (
                    <li key={currentWinsPage * WINS_PAGE_SIZE + i}>{win}</li>
                  ))}
                </ul>
                {winsPageCount > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => setWinsPage((p) => Math.max(0, p - 1))}
                      disabled={currentWinsPage === 0}
                    >
                      ← prev
                    </button>
                    <span className="page-indicator">
                      {currentWinsPage + 1} / {winsPageCount}
                    </span>
                    <button
                      onClick={() =>
                        setWinsPage((p) => Math.min(winsPageCount - 1, p + 1))
                      }
                      disabled={currentWinsPage === winsPageCount - 1}
                    >
                      next →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="empty">
                Nothing logged yet — wins land here the moment Forge observes one.
              </p>
            )}
          </section>
        </main>

        <div className="panel panel-right">
          <Pomodoro focus={focus} onLogged={onFocusLogged} />

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
        </div>
      </div>
    </aside>
  );
}
