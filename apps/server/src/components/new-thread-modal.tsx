'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AgentManifest, Machine, Project, ThreadPlacement } from '@taskyard/protocol';

type AgentInfo = AgentManifest & { id: string };

type PlacementChoice = 'auto' | 'local' | 'machine' | 'pool';

type NewThreadModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
};

function threadCapLabel(m: Machine): string {
  if (m.max_concurrent_threads == null) return '';
  const active = m.active_threads ?? 0;
  return ` · ${active}/${m.max_concurrent_threads} threads`;
}

export function NewThreadModal({ open, onClose, onCreated }: NewThreadModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [projectId, setProjectId] = useState('');
  const [agentType, setAgentType] = useState('');
  const [branch, setBranch] = useState('');
  const [prompt, setPrompt] = useState('');
  const [placementChoice, setPlacementChoice] = useState<PlacementChoice>('auto');
  const [machineId, setMachineId] = useState('');
  const [pool, setPool] = useState('default');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorHint, setErrorHint] = useState<string | null>(null);

  const runnableProjects = useMemo(
    () => projects.filter((p) => !p.archived && p.repo_url),
    [projects],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    setErrorHint(null);
    Promise.all([
      fetch('/api/projects').then((r) => r.json()),
      fetch('/api/agents').then((r) => r.json()),
      fetch('/api/machines').then((r) => r.json()),
    ]).then(([projData, agentData, machineData]) => {
      const projs = (projData.projects ?? []) as Project[];
      const ags = (agentData.agents ?? []) as AgentInfo[];
      const macs = (machineData.machines ?? []) as Machine[];
      setProjects(projs);
      setAgents(ags);
      setMachines(macs.filter((m) => m.status === 'online'));
      const runnable = projs.filter((p) => !p.archived && p.repo_url);
      if (runnable.length) {
        const selected = runnable.find((p) => p.id === projectId) ?? runnable[0];
        setProjectId(selected.id);
        setBranch(selected.default_branch);
      } else {
        setProjectId('');
        setBranch('');
      }
      if (ags.length && !agentType) setAgentType(ags[0].id);
    });
  }, [open, agentType]);

  useEffect(() => {
    if (!open) return;
    const project = runnableProjects.find((p) => p.id === projectId);
    if (project) setBranch(project.default_branch);
  }, [open, projectId, runnableProjects]);

  const localMachine = useMemo(
    () => machines.find((m) => m.is_local),
    [machines],
  );

  const pools = useMemo(() => {
    const names = new Set(machines.map((m) => m.pool || 'default'));
    return [...names].sort();
  }, [machines]);

  const placementPreview = useMemo(() => {
    if (placementChoice === 'local') {
      if (!localMachine) {
        return 'No local worker online — start one with --local';
      }
      return `Will run on ${localMachine.name} (this computer)`;
    }
    if (placementChoice === 'machine') {
      const m = machines.find((x) => x.id === machineId);
      return m ? `Will run on ${m.name}` : 'Choose a machine';
    }
    if (placementChoice === 'pool') {
      return `Will auto-pick best worker in pool "${pool}"`;
    }
    return 'Will auto-pick the best eligible worker (excludes manual-only and disabled)';
  }, [placementChoice, localMachine, machines, machineId, pool]);

  const localDisabled = placementChoice === 'local' && !localMachine;

  if (!open) return null;

  function buildPlacement(): ThreadPlacement {
    switch (placementChoice) {
      case 'local':
        return { mode: 'local' };
      case 'machine':
        return { mode: 'machine', machine_id: machineId };
      case 'pool':
        return { mode: 'pool', pool };
      default:
        return { mode: 'auto' };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setErrorHint(null);
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          agent_type: agentType,
          branch: branch || 'main',
          prompt,
          placement: buildPlacement(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorHint(typeof data.hint === 'string' ? data.hint : null);
        throw new Error(data.error ?? 'Failed to create thread');
      }
      onCreated(data.thread.id);
      onClose();
      setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-thread-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="new-thread-title">New thread</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {runnableProjects.length === 0 ? (
              <p className="modal-error">
                No runnable projects. Add a project with an HTTPS repository on the{' '}
                <a href="/projects">Projects</a> page.
              </p>
            ) : (
              <>
                <label className="form-field form-field-full">
                  <span className="form-label">Project</span>
                  <select
                    className="form-select"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    required
                  >
                    {runnableProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field form-field-full">
                  <span className="form-label">Agent</span>
                  <select
                    className="form-select"
                    value={agentType}
                    onChange={(e) => setAgentType(e.target.value)}
                    required
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-field form-field-full">
                  <span className="form-label">Branch</span>
                  <input
                    type="text"
                    className="form-input spec-mono"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    required
                  />
                </label>

                <fieldset className="form-field form-field-full placement-fieldset">
                  <legend className="form-label">Run on</legend>
                  <label className="placement-option">
                    <input
                      type="radio"
                      name="placement"
                      checked={placementChoice === 'auto'}
                      onChange={() => setPlacementChoice('auto')}
                    />
                    <span>Auto — best eligible worker</span>
                  </label>
                  <label className={`placement-option${localMachine ? '' : ' placement-option-disabled'}`}>
                    <input
                      type="radio"
                      name="placement"
                      checked={placementChoice === 'local'}
                      onChange={() => setPlacementChoice('local')}
                      disabled={!localMachine}
                    />
                    <span>
                      This computer
                      {localMachine
                        ? ` (${localMachine.name}${threadCapLabel(localMachine)})`
                        : ' — offline'}
                    </span>
                  </label>
                  <label className="placement-option">
                    <input
                      type="radio"
                      name="placement"
                      checked={placementChoice === 'pool'}
                      onChange={() => setPlacementChoice('pool')}
                    />
                    <span>Pool</span>
                    <select
                      className="form-select placement-inline-select"
                      value={pool}
                      disabled={placementChoice !== 'pool'}
                      onChange={(e) => setPool(e.target.value)}
                    >
                      {pools.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="placement-option">
                    <input
                      type="radio"
                      name="placement"
                      checked={placementChoice === 'machine'}
                      onChange={() => setPlacementChoice('machine')}
                    />
                    <span>Specific machine</span>
                    <select
                      className="form-select placement-inline-select"
                      value={machineId}
                      disabled={placementChoice !== 'machine'}
                      onChange={(e) => setMachineId(e.target.value)}
                      required={placementChoice === 'machine'}
                    >
                      <option value="">Choose…</option>
                      {machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                          {m.is_local ? ' · local' : ''}
                          {m.scheduling_mode === 'manual_only' ? ' · manual' : ''}
                          {m.cpu_percent != null ? ` · CPU ${m.cpu_percent.toFixed(0)}%` : ''}
                          {threadCapLabel(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="placement-preview">{placementPreview}</p>
                </fieldset>

                <label className="form-field form-field-full">
                  <span className="form-label">Prompt</span>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="What should the agent do?"
                    required
                  />
                </label>
              </>
            )}
            {error ? <p className="modal-error">{error}</p> : null}
            {errorHint ? <p className="placement-hint">{errorHint}</p> : null}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                submitting ||
                runnableProjects.length === 0 ||
                localDisabled ||
                (placementChoice === 'machine' && !machineId)
              }
            >
              {submitting ? 'Creating…' : 'Create thread'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
