'use client';

import { useState, type FormEvent } from 'react';
import { useSessionPerson } from '@/components/providers';

export function TerminalApproval() {
  const person = useSessionPerson();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [approved, setApproved] = useState(false);

  async function approve(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/auth/cli/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || 'Could not approve terminal sign-in.');
      }
      setApproved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve terminal sign-in.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={approve}>
        <p className="brand-name">Taskyard</p>
        <h1>{approved ? 'Terminal approved' : 'Approve terminal sign-in'}</h1>
        {approved ? (
          <p className="form-help" role="status">Return to your terminal to continue.</p>
        ) : (
          <>
            <p className="form-help">Enter the code from your terminal to sign it in as {person?.username}.</p>
            <label className="form-field">
              <span className="form-label">Terminal code</span>
              <input
                className="form-input"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={16}
                required
              />
            </label>
            {error ? <p className="form-error" role="alert">{error}</p> : null}
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? 'Approving…' : 'Approve terminal'}
            </button>
          </>
        )}
        <a href="/account">Go to account</a>
      </form>
    </div>
  );
}
