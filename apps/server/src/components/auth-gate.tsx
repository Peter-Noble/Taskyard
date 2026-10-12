'use client';

import { useState, type FormEvent } from 'react';

type AuthGateState =
  | { kind: 'setup' }
  | { kind: 'login' }
  | { kind: 'change-password'; username: string; displayName: string };

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export function AuthGate({ gate }: { gate: AuthGateState }) {
  if (gate.kind === 'setup') return <SetupForm />;
  if (gate.kind === 'change-password') return <PasswordForm username={gate.username} displayName={gate.displayName} />;
  return <LoginForm />;
}

function SetupForm() {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, display_name: displayName, password }),
      });
      if (!res.ok) throw new Error(await readError(res));
      window.location.assign('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the account');
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Create the first account"
      lead="This account is the first person on this Taskyard. Choose a username and a password."
      error={error}
      onSubmit={submit}
      pending={pending}
      submitLabel="Create account"
    >
      <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="Display name" value={displayName} onChange={setDisplayName} autoComplete="name" />
      <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
      <Field label="Confirm password" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />
    </AuthCard>
  );
}

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(await readError(res));
      window.location.assign('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      lead="Use the username and password for this Taskyard."
      error={error}
      onSubmit={submit}
      pending={pending}
      submitLabel="Sign in"
    >
      <Field label="Username" value={username} onChange={setUsername} autoComplete="username" />
      <Field label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />
    </AuthCard>
  );
}

function PasswordForm({ username, displayName }: { username: string; displayName: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: password }),
      });
      if (!res.ok) throw new Error(await readError(res));
      window.location.assign('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set the password');
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Set a new password"
      lead={`${displayName} (${username}) needs a new password before the rest of Taskyard opens.`}
      error={error}
      onSubmit={submit}
      pending={pending}
      submitLabel="Save password"
    >
      <Field label="New password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
      <Field label="Confirm password" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />
    </AuthCard>
  );
}

function AuthCard({
  title,
  lead,
  error,
  onSubmit,
  pending,
  submitLabel,
  children,
}: {
  title: string;
  lead: string;
  error: string | null;
  onSubmit: (event: FormEvent) => void;
  pending: boolean;
  submitLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="brand-name">Taskyard</p>
        <h1>{title}</h1>
        <p className="form-help">{lead}</p>
        {children}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'password';
  autoComplete: string;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <label className="form-field" htmlFor={id}>
      <span className="form-label">{label}</span>
      <input
        id={id}
        className="form-input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}
