'use client';

import type { FormEvent, ReactNode } from 'react';

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export function ChatMessage({
  role = 'system',
  className,
  header,
  children,
}: {
  role?: ChatMessageRole;
  className?: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <article className={`chat-msg ${className ?? `chat-msg-${role}`}`}>
      {header ? <header className="chat-msg-head">{header}</header> : null}
      <div className="chat-msg-body">{children}</div>
    </article>
  );
}

export function ChatCommentComposer({
  id,
  value,
  onChange,
  onSubmit,
  busy = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  busy?: boolean;
}) {
  return (
    <form className="chat-compose" onSubmit={(event) => void onSubmit(event)}>
      <label className="visually-hidden" htmlFor={id}>
        Add comment
      </label>
      <input
        id={id}
        className="chat-compose-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Add a comment…"
      />
      <button type="submit" className="btn btn-primary chat-compose-send" disabled={busy}>
        Comment
      </button>
    </form>
  );
}
