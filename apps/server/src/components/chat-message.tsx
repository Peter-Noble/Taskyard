'use client';

import React, { useEffect, useRef } from 'react';
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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = '0px';
    input.style.height = `${input.scrollHeight}px`;
  }, [value]);

  return (
    <form className="chat-compose" onSubmit={(event) => void onSubmit(event)}>
      <label className="visually-hidden" htmlFor={id}>
        Add comment
      </label>
      <textarea
        ref={inputRef}
        id={id}
        className="chat-compose-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || !event.ctrlKey) return;
          event.preventDefault();
          if (!busy && value.trim()) event.currentTarget.form?.requestSubmit();
        }}
        placeholder="Add a comment…"
        autoComplete="off"
        rows={1}
      />
      <button
        type="submit"
        className="btn btn-primary chat-compose-send"
        disabled={busy || !value.trim()}
      >
        {busy ? 'Posting…' : 'Comment'}
      </button>
    </form>
  );
}
