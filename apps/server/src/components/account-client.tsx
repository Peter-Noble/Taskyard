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

export function AccountClient() {
  const person = useSessionPerson();
  const [displayName, setDisplayName] = useState(person?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<'name' | 'password' | null>(null);

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
      </div>
    </AppShell>
  );
}
