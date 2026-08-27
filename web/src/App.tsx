import { useCallback, useEffect, useState } from 'react';
import { getState } from './api';
import { Dashboard } from './components/Dashboard';
import type { AppState, Focus, FocusDay } from './types';

/**
 * The ledger is written from the terminal, not from here, so the dashboard polls
 * to stay honest. Slow enough to be invisible, fast enough that a level change
 * shows up while the learner is still looking at the screen.
 */
const POLL_MS = 4000;

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getState());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Focus is written by this page, so apply it locally instead of waiting a poll.
  const onFocusLogged = useCallback((focus: Focus, week: FocusDay[]) => {
    setState((s) => (s ? { ...s, focus, week } : s));
  }, []);

  if (!state) {
    return (
      <div className="boot">
        {error ? <div className="notice error">{error}</div> : 'loading the forge…'}
      </div>
    );
  }

  return (
    <div className="app">
      {!state.onboarded && (
        <section className="cold-open">
          <h2>the forge</h2>
          <p>
            No ledger yet. Open a terminal and run <code>/forge</code> in Claude Code to begin
            onboarding — this page fills in as the apprenticeship proceeds.
          </p>
        </section>
      )}

      {error && <div className="notice error">{error}</div>}

      <Dashboard
        ledger={state.ledger}
        phaseProgress={state.phase_progress}
        focus={state.focus}
        week={state.week}
        onFocusLogged={onFocusLogged}
      />
    </div>
  );
}
