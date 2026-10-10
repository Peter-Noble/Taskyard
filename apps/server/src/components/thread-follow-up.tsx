'use client';

import { useState } from 'react';
import type { ThreadState } from '@taskyard/protocol';
import { isActiveThread } from '@/lib/format-ui';

type ThreadFollowUpProps = {
  threadId: string;
  status: ThreadState;
  disabled?: boolean;
  placeholder?: string;
  onSent?: () => void;
};

export function canSendFollowUp(status: ThreadState): boolean {
  return isActiveThread(status);
}

export function ThreadFollowUp({
  threadId,
  status,
  disabled = false,
  placeholder = 'Send a follow-up…',
  onSent,
}: ThreadFollowUpProps) {
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = canSendFollowUp(status);
  const inputDisabled = disabled || !canSend || submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || inputDisabled) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${threadId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Follow-up failed');
      }
      setPrompt('');
      onSent?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Follow-up failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="chat-compose thread-follow-up" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={`follow-up-${threadId}`}>
        Follow-up message
      </label>
      <input
        id={`follow-up-${threadId}`}
        type="text"
        className="chat-compose-input"
        placeholder={canSend ? placeholder : 'Thread is not running'}
        aria-label="Follow-up message"
        value={prompt}
        disabled={inputDisabled}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button type="submit" className="btn btn-primary chat-compose-send" disabled={inputDisabled || !prompt.trim()}>
        {submitting ? 'Sending…' : 'Send'}
      </button>
      {error ? <p className="modal-error thread-follow-up-error">{error}</p> : null}
    </form>
  );
}
