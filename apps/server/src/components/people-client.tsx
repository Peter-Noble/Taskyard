'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/app-shell';

type PersonRow = {
  id: string;
  username: string;
  display_name: string;
  must_change_password: boolean;
  created_at: string;
};

type Revealed = {
  username: string;
  displayName: string;
  temporaryPassword: string;
};

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function PeopleClient() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/people');
    if (!res.ok) throw new Error(await readError(res));
    const data = (await res.json()) as { people: PersonRow[] };
    setPeople(data.people);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load()
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load people');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName }),
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { person: PersonRow; temporary_password: string };
      setRevealed({
        username: data.person.username,
        displayName: data.person.display_name,
        temporaryPassword: data.temporary_password,
      });
      setUsername('');
      setDisplayName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the person');
    } finally {
      setCreating(false);
    }
  }

  async function markReset(person: PersonRow) {
    setBusyId(person.id);
    setError(null);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(person.id)}/reset`, { method: 'POST' });
      if (!res.ok) throw new Error(await readError(res));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark the password reset');
    } finally {
      setBusyId(null);
    }
  }

  async function issuePassword(person: PersonRow) {
    setBusyId(person.id);
    setError(null);
    try {
      const res = await fetch(`/api/people/${encodeURIComponent(person.id)}/temporary-password`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as { person: PersonRow; temporary_password: string };
      setRevealed({
        username: data.person.username,
        displayName: data.person.display_name,
        temporaryPassword: data.temporary_password,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue a temporary password');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <div className="people-page">
        <h1>People</h1>
        <p className="form-help">
          Create a person with a username and a display name. Taskyard shows a temporary password once.
          Pass that username and password on yourself. Their next sign-in must set a new password.
        </p>

        {revealed ? (
          <div className="people-secret" role="status">
            <p>
              Give these to {revealed.displayName}. This password is shown once and is not stored.
            </p>
            <p>
              <span className="form-label">Username</span>
              <code>{revealed.username}</code>
            </p>
            <p>
              <span className="form-label">Temporary password</span>
              <code>{revealed.temporaryPassword}</code>
            </p>
            <button type="button" className="btn" onClick={() => setRevealed(null)}>
              Dismiss
            </button>
          </div>
        ) : null}

        <form className="people-create" onSubmit={create}>
          <label className="form-field">
            <span className="form-label">Username</span>
            <input
              className="form-input"
              value={username}
              autoComplete="off"
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span className="form-label">Display name</span>
            <input
              className="form-input"
              value={displayName}
              autoComplete="off"
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create person'}
          </button>
        </form>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? <p className="empty-state">Loading people…</p> : null}

        <ul className="people-list">
          {people.map((person) => (
            <li key={person.id} className="people-row">
              <div>
                <strong>{person.display_name}</strong>
                <span className="people-username">{person.username}</span>
                <span className="people-meta">{new Date(person.created_at).toLocaleString()}</span>
                {person.must_change_password ? <span className="people-flag">Reset waiting</span> : null}
              </div>
              <div className="people-row-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === person.id}
                  onClick={() => void markReset(person)}
                >
                  Mark for password reset
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busyId === person.id}
                  onClick={() => void issuePassword(person)}
                >
                  New temporary password
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
