import { useEffect, useRef, useState } from 'react';
import type { Focus } from '../types';
import { logFocus } from '../api';

const FOCUS_MINUTES = 25;
const BREAK_MINUTES = 5;

/**
 * A rhythm the learner keeps, not a deadline anyone enforces (§7.1) — so there is
 * no alarm and no countdown pressure, just a clock and a count that persists.
 */
export function Pomodoro({ focus, onLogged }: { focus: Focus; onLogged: (focus: Focus) => void }) {
  const [mode, setMode] = useState<'focus' | 'break'>('focus');
  const [remaining, setRemaining] = useState(FOCUS_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const completing = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setRemaining((r) => r - 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining > 0 || completing.current) return;
    completing.current = true;
    setRunning(false);

    const finished = mode;
    const minutes = finished === 'focus' ? FOCUS_MINUTES : BREAK_MINUTES;
    logFocus(finished, minutes)
      .then((res) => onLogged(res.focus))
      .catch(() => undefined)
      .finally(() => {
        const next = finished === 'focus' ? 'break' : 'focus';
        setMode(next);
        setRemaining((next === 'focus' ? FOCUS_MINUTES : BREAK_MINUTES) * 60);
        completing.current = false;
      });
  }, [remaining, mode, onLogged]);

  function reset() {
    setRunning(false);
    setRemaining((mode === 'focus' ? FOCUS_MINUTES : BREAK_MINUTES) * 60);
  }

  const clamped = Math.max(remaining, 0);
  const clock = `${Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;

  return (
    <section className="card timer">
      <header>
        <h3>Focus</h3>
        <span className="stat">
          {focus.minutes} min · {focus.pomodoros} 🍅 today
        </span>
      </header>
      <div className={`clock ${mode}`}>{clock}</div>
      <div className="timer-actions">
        <button onClick={() => setRunning((r) => !r)}>{running ? 'pause' : 'start'}</button>
        <button onClick={reset}>reset</button>
        <span className="mode">{mode === 'focus' ? '25 min focus' : '5 min break'}</span>
      </div>
    </section>
  );
}
