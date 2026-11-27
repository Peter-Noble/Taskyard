'use client';

import { useState, type FormEvent } from 'react';
import { AppShell } from '@/components/app-shell';
import { useSessionPerson } from '@/components/providers';

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

type TerminalSession = { id: string; createdAt: Date | null; expiresAt: Date };

export function AccountClient({ cliSessions }: { cliSessions: TerminalSession[] }) {
  const person = useSessionPerson();
  const [displayName, setDisplayName] = useState(person?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'name' | 'password' | 'sign-out' | 'terminal' | null>(null);
  const [terminalSessions, setTerminalSessions] = useState(cliSessions);

  async function revokeTerminal(id: string) {
    setPending('terminal');
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/auth/cli/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readError(res));
      setTerminalSessions((current) => current.filter((session) => session.id !== id));
      setMessage('Terminal signed out.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out the terminal');
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    setPending('sign-out');
    setError(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.assign('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out');
      setPending(null);
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setPending('name');
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName }),
      });
      if (!res.ok) throw new Error(await readError(res));
      window.location.assign('/account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the display name');
      setPending(null);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setPending('password');
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setMessage('Password saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the password');
    } finally {
      setPending(null);
    }
  }

  return (
    <AppShell>
      <div className="people-page">
        <h1>Account</h1>
        <p className="form-help">
          Signed in as {person?.displayName} ({person?.username}). The username does not change.
        </p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="form-help">{message}</p> : null}

        <form className="people-create" onSubmit={saveName}>
          <label className="form-field">
            <span className="form-label">Display name</span>
            <input
              className="form-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending !== null}>
            {pending === 'name' ? 'Saving…' : 'Save display name'}
          </button>
        </form>

        <form className="people-create" onSubmit={savePassword}>
          <label className="form-field">
            <span className="form-label">Current password</span>
            <input
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">New password</span>
            <input
              className="form-input"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">Confirm password</span>
            <input
              className="form-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending !== null}>
            {pending === 'password' ? 'Saving…' : 'Change password'}
          </button>
        </form>

        {terminalSessions.length > 0 ? (
          <section>
            <h2>Terminal sessions</h2>
            <ul>
              {terminalSessions.map((session) => (
                <li key={session.id}>
                  <span>Signed in {session.createdAt?.toUTCString()} · Expires {session.expiresAt.toUTCString()}</span>{' '}
                  <button type="button" className="btn" disabled={pending !== null} onClick={() => void revokeTerminal(session.id)}>
                    Sign out terminal
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <button type="button" className="btn account-sign-out" disabled={pending !== null} onClick={() => void signOut()}>
          {pending === 'sign-out' ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </AppShell>
  );
}
