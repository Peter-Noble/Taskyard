'use client';

import { useEffect, useState } from 'react';
import type { AgentManifest, Machine, Project } from '@taskyard/protocol';

type AgentInfo = AgentManifest & { id: string };

type NewThreadModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (threadId: string) => void;
};

export function NewThreadModal({ open, onClose, onCreated }: NewThreadModalProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [projectId, setProjectId] = useState('');
  const [agentType, setAgentType] = useState('');
  const [branch, setBranch] = useState('');
  const [prompt, setPrompt] = useState('');
  const [machineId, setMachineId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
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
      if (projs.length && !projectId) {
        setProjectId(projs[0].id);
        setBranch(projs[0].default_branch);
      }
      if (ags.length && !agentType) setAgentType(ags[0].id);
    });
  }, [open, projectId, agentType]);

  useEffect(() => {
    const project = projects.find((p) => p.id === projectId);
    if (project && !branch) setBranch(project.default_branch);
  }, [projectId, projects, branch]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          agent_type: agentType,
          branch: branch || 'main',
          prompt,
          ...(machineId ? { machine_id: machineId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create thread');
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
            {projects.length === 0 ? (
              <p className="modal-error">
                No projects configured. Add entries to projects.json and restart the server.
              </p>
            ) : (
              <>
                <label className="form-field form-field-full">
                  <span className="form-label">Project</span>
                  <select
                    className="form-select"
                    value={projectId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setProjectId(id);
                      const p = projects.find((x) => x.id === id);
                      if (p) setBranch(p.default_branch);
                    }}
                    required
                  >
                    {projects.map((p) => (
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
                <label className="form-field form-field-full">
                  <span className="form-label">Machine</span>
                  <select
                    className="form-select"
                    value={machineId}
                    onChange={(e) => setMachineId(e.target.value)}
                  >
                    <option value="">Auto (best available)</option>
                    {machines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.cpu_percent != null ? ` · CPU ${m.cpu_percent.toFixed(0)}%` : ''}
                      </option>
                    ))}
                  </select>
                </label>
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
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || projects.length === 0}
            >
              {submitting ? 'Creating…' : 'Create thread'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
