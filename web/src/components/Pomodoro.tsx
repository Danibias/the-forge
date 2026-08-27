import { useEffect, useRef, useState } from 'react';
import type { Focus, FocusDay } from '../types';
import { logFocus } from '../api';

const FOCUS_MINUTES = 25;
const SHORT_BREAK_MINUTES = 5;
const LONG_BREAK_MINUTES = 15;
// Standard Pomodoro cadence: a long break after every 4th focus block.
const LONG_BREAK_INTERVAL = 4;

// The session-length gate: the floor a session should clear, the points
// where it's worth checking in, and the hard stop nobody talks their way past.
const MIN_SESSION_MINUTES = 90; // 1.5h
const CHECKPOINT_MINUTES = [90, 180]; // 1.5h, 3h — ask to continue
const HARD_STOP_MINUTES = 300; // 5h — closes on its own, no asking

type Mode = 'focus' | 'short-break' | 'long-break';

const MODE_MINUTES: Record<Mode, number> = {
  focus: FOCUS_MINUTES,
  'short-break': SHORT_BREAK_MINUTES,
  'long-break': LONG_BREAK_MINUTES,
};

const MODE_LABEL: Record<Mode, string> = {
  focus: `${FOCUS_MINUTES} min focus`,
  'short-break': `${SHORT_BREAK_MINUTES} min short break`,
  'long-break': `${LONG_BREAK_MINUTES} min long break`,
};

interface Gate {
  answered: number[]; // checkpoints already resolved today
  closed: boolean;
  reason: 'voluntary' | 'rest' | null;
}

// Local calendar date, matching the server's focusWeek/focusToday day
// boundaries — `toISOString` reports UTC, which shifts the date by one in
// any timezone ahead of UTC and desyncs the gate from the streak block.
function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function gateKey(day: string): string {
  return `forge:session-gate:${day}`;
}

function loadGate(day: string): Gate {
  try {
    const raw = localStorage.getItem(gateKey(day));
    if (raw) return JSON.parse(raw) as Gate;
  } catch {
    // localStorage can throw (private mode, blocked) — fall through to a fresh gate.
  }
  return { answered: [], closed: false, reason: null };
}

// How often to check the calendar date and the clock. The dashboard is meant
// to stay open for hours (§7.1), so both can roll over under it without a
// reload — cheap enough to poll, and a few seconds of lag is invisible.
const CLOCK_TICK_MS = 30_000;

// No session between 10pm and 7am — the learner's day job runs to 10pm on
// workdays and mornings are the only real study window (§7.1: a rhythm the
// learner keeps, but a floor under it that isn't optional).
const CURFEW_START_HOUR = 22;
const CURFEW_END_HOUR = 7;

function isCurfew(d: Date): boolean {
  const h = d.getHours();
  return h >= CURFEW_START_HOUR || h < CURFEW_END_HOUR;
}

// A short tone marking a boundary that already happened — never a countdown,
// never pressure (§7.1). Phase changes get two quick notes; the hard stop
// gets a slower, lower, three-note tone so it reads as different in kind.
function chime(freqs: number[], gapSec = 0.18) {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    let t = ctx.currentTime;
    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + gapSec + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + gapSec + 0.06);
      t += gapSec;
    });
    setTimeout(() => void ctx.close(), (freqs.length * gapSec + 0.6) * 1000);
  } catch {
    // Audio isn't available everywhere (autoplay policy, unsupported browser) — silent no-op.
  }
}

/**
 * A rhythm the learner keeps, not a deadline anyone enforces (§7.1). The
 * alarm and the gate only mark boundaries that already passed or a real
 * rest limit — they never count down toward one.
 */
export function Pomodoro({
  focus,
  onLogged,
}: {
  focus: Focus;
  onLogged: (focus: Focus, week: FocusDay[]) => void;
}) {
  const [mode, setMode] = useState<Mode>('focus');
  const [remaining, setRemaining] = useState(FOCUS_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [day, setDay] = useState(today);
  const [gate, setGate] = useState<Gate>(() => loadGate(day));
  const [now, setNow] = useState(() => new Date());
  const completing = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(gateKey(day), JSON.stringify(gate));
    } catch {
      // Non-fatal — worst case the gate re-asks after a reload.
    }
  }, [gate, day]);

  // Synchronize the session to the current day: yesterday's "closed" or
  // answered checkpoints have no business gating a session that hasn't
  // started yet. The server's focus.minutes resets at midnight on its own
  // (focusToday); the gate has to be told explicitly to follow it. The same
  // tick drives the curfew check below, since both need a clock that keeps
  // moving while the dashboard just sits open.
  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      const t = today();
      if (t !== day) {
        setDay(t);
        setGate(loadGate(t));
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [day]);

  const curfew = isCurfew(now);

  // A session already running when 10pm arrives gets paused, not force-
  // completed — it just can't keep running, same as it couldn't have started.
  useEffect(() => {
    if (curfew && running) setRunning(false);
  }, [curfew, running]);

  // The hard stop is enforced on its own — no question, no way to talk past it.
  useEffect(() => {
    if (gate.closed || focus.minutes < HARD_STOP_MINUTES) return;
    setRunning(false);
    setGate((g) => ({ ...g, closed: true, reason: 'rest' }));
    chime([440, 349.2, 293.7], 0.26);
  }, [focus.minutes, gate.closed]);

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
    const minutes = MODE_MINUTES[finished];
    const kind = finished === 'focus' ? 'focus' : 'break';

    logFocus(kind, minutes)
      .then((res) => {
        onLogged(res.focus, res.week);
        const next: Mode =
          finished === 'focus'
            ? res.focus.pomodoros % LONG_BREAK_INTERVAL === 0
              ? 'long-break'
              : 'short-break'
            : 'focus';
        chime(next === 'focus' ? [880, 1108.7] : [659.3, 523.3]);
        setMode(next);
        setRemaining(MODE_MINUTES[next] * 60);
      })
      .catch(() => undefined)
      .finally(() => {
        completing.current = false;
      });
  }, [remaining, mode, onLogged]);

  const pendingCheckpoint = gate.closed
    ? null
    : (CHECKPOINT_MINUTES.find(
        (cp) => focus.minutes >= cp && !gate.answered.includes(cp),
      ) ?? null);

  function answerCheckpoint(checkpoint: number, keepGoing: boolean) {
    if (!keepGoing) setRunning(false);
    setGate((g) => ({
      ...g,
      answered: [...g.answered, checkpoint],
      closed: g.closed || !keepGoing,
      reason: !keepGoing ? 'voluntary' : g.reason,
    }));
  }

  function toggleRunning() {
    setRunning((r) => !r);
  }

  function reset() {
    setRunning(false);
    setRemaining(MODE_MINUTES[mode] * 60);
  }

  const locked = gate.closed || pendingCheckpoint !== null || curfew;
  const combinedHours = focus.minutes / 60;

  const clamped = Math.max(remaining, 0);
  const clock = `${Math.floor(clamped / 60)
    .toString()
    .padStart(2, '0')}:${(clamped % 60).toString().padStart(2, '0')}`;

  return (
    <section className={`card timer stage-${mode}`}>
      <header>
        <h3>Focus</h3>
        <span className="stat">
          {focus.minutes} min ({combinedHours.toFixed(1)}h) · {focus.pomodoros} 🍅 today
        </span>
      </header>
      <div className={`clock ${mode}`}>{clock}</div>
      <div className="timer-actions">
        <button onClick={toggleRunning} disabled={locked}>
          {running ? 'pause' : 'start'}
        </button>
        <button onClick={reset} disabled={gate.closed}>
          reset
        </button>
        <span className="mode">{MODE_LABEL[mode]}</span>
      </div>

      {curfew && (
        <div className="gate-banner closed warn">
          <p>10pm–7am — no sessions. Back at 7.</p>
        </div>
      )}

      {!curfew && pendingCheckpoint !== null && (
        <div className="gate-banner ask">
          <p>
            You've hit {(pendingCheckpoint / 60).toFixed(1)}h today
            {pendingCheckpoint === MIN_SESSION_MINUTES ? ' — the floor for a session' : ''}. Keep
            going?
          </p>
          <div className="gate-actions">
            <button className="primary" onClick={() => answerCheckpoint(pendingCheckpoint, true)}>
              yes, continue
            </button>
            <button onClick={() => answerCheckpoint(pendingCheckpoint, false)}>
              no, stop here
            </button>
          </div>
        </div>
      )}

      {!curfew && gate.closed && (
        <div className={`gate-banner closed${gate.reason === 'rest' ? ' warn' : ''}`}>
          <p>
            {gate.reason === 'rest'
              ? "5 hours today — you need to rest. Session closed."
              : 'Session closed for today. Good stopping point.'}
          </p>
        </div>
      )}
    </section>
  );
}
