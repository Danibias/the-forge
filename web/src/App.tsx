import { useCallback, useEffect, useRef, useState } from 'react';
import { getState, streamTurn } from './api';
import { Chat } from './components/Chat';
import { Composer } from './components/Composer';
import { Dashboard } from './components/Dashboard';
import type { AppState, Focus, Ledger, TranscriptMessage } from './types';

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [streaming, setStreaming] = useState('');
  const [thinking, setThinking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await getState());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const run = useCallback(
    async (body: { message?: string; kind?: 'user' | 'session_start' }) => {
      setBusy(true);
      setError(null);
      setStreaming('');
      setThinking(true);

      // Show the learner's own turn immediately; the server is the source of truth.
      if (body.message) {
        const optimistic: TranscriptMessage = {
          id: Date.now(),
          role: 'user',
          text: body.message,
          at: new Date().toISOString(),
        };
        setState((s) => (s ? { ...s, messages: [...s.messages, optimistic] } : s));
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await streamTurn(
          body,
          (event) => {
            switch (event.type) {
              case 'delta':
                setThinking(false);
                setStreaming((prev) => prev + event.text);
                break;
              case 'thinking':
                setThinking(true);
                break;
              case 'ledger':
                setState((s) => (s ? { ...s, ledger: event.ledger as Ledger } : s));
                break;
              case 'error':
                setError(event.message);
                if (body.message) setDraft((d) => d || (body.message as string));
                break;
              default:
                break;
            }
          },
          controller.signal,
        );
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'The turn failed.');
        }
        // Aborted or failed, the server unwound the turn — give the text back.
        if (body.message) setDraft((d) => d || (body.message as string));
      } finally {
        abortRef.current = null;
        setBusy(false);
        setThinking(false);
        setStreaming('');
        await refresh();
      }
    },
    [refresh],
  );

  const onFocusLogged = useCallback((focus: Focus) => {
    setState((s) => (s ? { ...s, focus } : s));
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
      <main className="chat">
        <Chat
          messages={state.messages}
          streaming={streaming}
          thinking={thinking}
          error={error}
          ready={state.ready}
          started={state.started}
          busy={busy}
          onStart={() => void run({ kind: 'session_start' })}
        />
        <Composer
          disabled={!state.ready || busy}
          busy={busy}
          draft={draft}
          onDraft={setDraft}
          onSend={(text) => {
            setDraft('');
            void run({ message: text });
          }}
          onStop={() => abortRef.current?.abort()}
        />
      </main>

      <Dashboard
        ledger={state.ledger}
        phaseProgress={state.phase_progress}
        focus={state.focus}
        onFocusLogged={onFocusLogged}
      />
    </div>
  );
}
