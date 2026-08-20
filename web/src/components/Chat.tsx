import { useEffect, useRef } from 'react';
import type { TranscriptMessage } from '../types';
import { Markdown } from './Markdown';

interface Props {
  messages: TranscriptMessage[];
  streaming: string;
  thinking: boolean;
  error: string | null;
  onStart: () => void;
  started: boolean;
  ready: boolean;
  busy: boolean;
}

export function Chat({
  messages,
  streaming,
  thinking,
  error,
  onStart,
  started,
  ready,
  busy,
}: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, streaming, thinking]);

  return (
    <div className="transcript">
      {!ready && (
        <div className="notice">
          <strong>No API key.</strong> Put <code>ANTHROPIC_API_KEY</code> in <code>.env</code> at
          the repo root and restart the server.
        </div>
      )}

      {ready && !started && (
        <div className="cold-open">
          <h2>the forge</h2>
          <p>
            A long apprenticeship, not a tutorial. Forge reads your ledger, opens the session, and
            writes back what you demonstrated.
          </p>
          <button className="primary" onClick={onStart}>
            Begin the first session
          </button>
        </div>
      )}

      {messages.map((message) => (
        <article key={message.id} className={`turn ${message.role}`}>
          <div className="who">{message.role === 'user' ? 'you' : 'forge'}</div>
          <div className="body">
            <Markdown text={message.text} />
          </div>
        </article>
      ))}

      {(streaming || thinking) && (
        <article className="turn assistant">
          <div className="who">forge</div>
          <div className="body">
            {streaming ? <Markdown text={streaming} /> : null}
            {thinking && !streaming && <div className="thinking">thinking…</div>}
          </div>
        </article>
      )}

      {error && <div className="notice error">{error}</div>}

      {started && ready && messages.length > 0 && !busy && (
        <div className="session-controls">
          <button onClick={onStart}>Open a new session</button>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
