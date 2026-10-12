'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app-shell';

function CopyBlock({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <strong>{label}</strong>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(command);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className="spec-mono"
        style={{
          margin: 0,
          padding: 12,
          overflowX: 'auto',
          background: 'var(--surface-2, rgba(0,0,0,0.04))',
          borderRadius: 6,
        }}
      >
        {command}
      </pre>
    </div>
  );
}

export function InstallClient() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const bash = origin ? `curl -fsSL ${origin}/install.sh | bash` : 'curl -fsSL <origin>/install.sh | bash';
  const ps = origin ? `irm ${origin}/install.ps1 | iex` : 'irm <origin>/install.ps1 | iex';

  return (
    <AppShell pageTitle="Install CLI">
      <div className="main-padded">
        <p className="page-lead" style={{ marginBottom: 20 }}>
          Install the agent/dev <code className="spec-mono">taskyard</code> CLI on your machine.
          Requires Node.js 20+ on PATH. The installer sets this instance as the default server URL.
          When this server is redeployed, the CLI warns if its artifact hash changed — run{' '}
          <code className="spec-mono">taskyard update</code>.
        </p>
        <div className="card" style={{ padding: 20, maxWidth: 720 }}>
          <CopyBlock label="macOS / Linux" command={bash} />
          <CopyBlock label="Windows (PowerShell)" command={ps} />
          <p style={{ margin: 0, opacity: 0.85 }}>
            After install: <code className="spec-mono">taskyard setup --project &lt;id&gt;</code>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
