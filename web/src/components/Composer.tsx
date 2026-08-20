import { useEffect, useRef, useState } from 'react';

interface Props {
  disabled: boolean;
  busy: boolean;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function Composer({ disabled, busy, draft, onDraft, onSend, onStop }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
    el.style.overflowY = el.scrollHeight > 260 ? 'auto' : 'hidden';
    setRows(draft.split('\n').length);
  }, [draft]);

  function submit() {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
  }

  return (
    <div className="composer">
      <textarea
        ref={ref}
        value={draft}
        rows={rows}
        placeholder={busy ? 'Forge is answering…' : 'Answer, ask, or paste code…'}
        disabled={disabled}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {busy ? (
        <button className="stop" onClick={onStop} title="Stop this turn">
          stop
        </button>
      ) : (
        <button className="primary" onClick={submit} disabled={disabled || !draft.trim()}>
          send
        </button>
      )}
    </div>
  );
}
