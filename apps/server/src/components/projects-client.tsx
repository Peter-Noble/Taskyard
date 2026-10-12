'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AppShell } from '@/components/app-shell';
import { useTestData } from '@/lib/hooks/use-test-data';
import { useJsonFetch } from '@/lib/hooks/use-json-fetch';
import { TEST_PROJECTS } from '@/lib/test-data/fixtures';
import type {
  CreateProjectRequest,
  Project,
  ProjectTaskCounts,
  UpdateProjectRequest,
} from '@taskyard/protocol';
import { useCollections } from '@/components/collection-provider';
import { projectsInCollection, type CollectionSummary } from '@/lib/active-collection';

function repoMeta(project: Project): string {
  if (!project.repo_url) return 'No repository';
  return project.repo_url;
}

function taskCounts(project: Project): ProjectTaskCounts {
  return (
    project.task_counts ?? { backlog: 0, ready: 0, in_progress: 0, review: 0, merge: 0, waiting: 0 }
  );
}

function moveProject(items: Project[], fromId: string, toId: string): Project[] {
  const from = items.findIndex((item) => item.id === fromId);
  const to = items.findIndex((item) => item.id === toId);
  if (from < 0 || to < 0 || from === to) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return items;
  next.splice(to, 0, moved);
  return next;
}

function placeSection(all: Project[], nextSection: Project[]): Project[] {
  const queue = [...nextSection];
  const moving = new Set(nextSection.map((project) => project.id));
  return all.map((project) => (moving.has(project.id) ? queue.shift() ?? project : project));
}

function GripIcon() {
  return (
    <svg className="project-grab-icon" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="4.5" cy="2.5" r="1.15" />
      <circle cx="9.5" cy="2.5" r="1.15" />
      <circle cx="4.5" cy="7" r="1.15" />
      <circle cx="9.5" cy="7" r="1.15" />
      <circle cx="4.5" cy="11.5" r="1.15" />
      <circle cx="9.5" cy="11.5" r="1.15" />
    </svg>
  );
}

function ProjectBadges({ project, muted }: { project: Project; muted?: boolean }) {
  const counts = taskCounts(project);
  const open =
    counts.backlog + counts.ready + counts.in_progress + counts.review + counts.merge + counts.waiting;
  const taskBadges = [
    counts.ready > 0 ? { key: 'ready', className: 'badge-task-ready', label: `${counts.ready} ready` } : null,
    counts.in_progress > 0
      ? { key: 'progress', className: 'badge-task-progress', label: `${counts.in_progress} in progress` }
      : null,
    counts.review > 0 ? { key: 'review', className: 'badge-task-review', label: `${counts.review} review` } : null,
    counts.merge > 0 ? { key: 'merge', className: 'badge-task-merge', label: `${counts.merge} merge` } : null,
    counts.waiting > 0
      ? { key: 'waiting', className: 'badge-task-waiting', label: `${counts.waiting} waiting` }
      : null,
    counts.backlog > 0
      ? { key: 'backlog', className: 'badge-task-backlog', label: `${counts.backlog} backlog` }
      : null,
  ].filter((badge): badge is { key: string; className: string; label: string } => badge !== null);

  return (
    <span className="project-badges">
      {muted ? (
        <span className="badge badge-task-done overview-item-badge">
          <span className="badge-dot" />
          Archived
        </span>
      ) : null}
      {!muted && !project.repo_url ? (
        <span className="badge badge-waiting overview-item-badge">
          <span className="badge-dot" />
          No repo
        </span>
      ) : null}
      <span className="badge badge-running overview-item-badge">
        <span className="badge-dot" />
        {project.active_threads ?? 0} active
      </span>
      {taskBadges.length > 0 ? (
        taskBadges.map((badge) => (
          <span key={badge.key} className={`badge ${badge.className} overview-item-badge`}>
            <span className="badge-dot" />
            {badge.label}
          </span>
        ))
      ) : (
        <span className="badge badge-task-backlog overview-item-badge">
          <span className="badge-dot" />
          {open} tasks
        </span>
      )}
    </span>
  );
}

function CreateProjectModal({
  open,
  onClose,
  onCreated,
  testDataOn,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  testDataOn: boolean;
}) {
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('main');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (testDataOn) {
      setError('Disabled in test-data mode');
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: CreateProjectRequest = {
      name: name.trim(),
      default_branch: defaultBranch.trim() || 'main',
      repo_url: repoUrl.trim() === '' ? null : repoUrl.trim(),
    };
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create project');
      setName('');
      setRepoUrl('');
      setDefaultBranch('main');
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
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
        aria-labelledby="new-project-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="new-project-title">New project</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <label className="form-field form-field-full">
              <span className="form-label">Name</span>
              <input
                type="text"
                className="form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Taskyard"
                required
              />
            </label>
            <label className="form-field form-field-full">
              <span className="form-label">Repository (HTTPS, optional)</span>
              <input
                type="url"
                className="form-input spec-mono"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/org/repo.git"
              />
            </label>
            <p className="project-form-hint">
              Private repos use the <code className="spec-mono">GIT_PAT</code> vault key when
              workers clone or update mirrors.
            </p>
            <label className="form-field form-field-full">
              <span className="form-label">Default branch</span>
              <input
                type="text"
                className="form-input spec-mono"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                required
              />
            </label>
            {error ? <p className="modal-error">{error}</p> : null}
          </div>
          <footer className="modal-foot">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || testDataOn}>
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function CollectionsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { collections, create, remove } = useCollections();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'delete' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setName('');
    setError(null);
    setBusy(null);
    setConfirmDeleteId(null);
  }, [open]);

  if (!open) return null;

  async function createCollection(event: FormEvent) {
    event.preventDefault();
    setBusy('create');
    setError(null);
    setConfirmDeleteId(null);
    try {
      await create(name);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the collection');
    } finally {
      setBusy(null);
    }
  }

  async function deleteCollection(id: string) {
    setBusy('delete');
    setError(null);
    try {
      await remove(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the collection');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="collections-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-head">
          <h2 id="collections-title">Collections</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="modal-body">
          <p className="form-help">
            Private groups for the projects you see. Press a collection name on a project to add or
            remove it.
          </p>
          <form className="collection-dialog-create" onSubmit={(event) => void createCollection(event)}>
            <label className="form-field">
              <span className="form-label">New collection</span>
              <input
                className="form-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy !== null}>
              {busy === 'create' ? 'Creating…' : 'Create collection'}
            </button>
          </form>
          {error ? (
            <p className="modal-error" role="alert">
              {error}
            </p>
          ) : null}
          {collections.length > 0 ? (
            <ul className="collection-dialog-list">
              {collections.map((collection) => (
                <li key={collection.id} className="collection-dialog-row">
                  <strong>{collection.name}</strong>
                  {confirmDeleteId === collection.id ? (
                    <span className="collection-dialog-confirm">
                      <span className="people-meta">Delete {collection.name}?</span>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        disabled={busy !== null}
                        onClick={() => void deleteCollection(collection.id)}
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy !== null}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy !== null}
                      onClick={() => setConfirmDeleteId(collection.id)}
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="form-help">No collections yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ProjectRow({
  project: initial,
  testDataOn,
  onSaved,
  archived,
}: {
  project: Project;
  testDataOn: boolean;
  onSaved: () => void;
  archived?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [repoUrl, setRepoUrl] = useState(initial.repo_url ?? '');
  const [defaultBranch, setDefaultBranch] = useState(initial.default_branch);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const counts = taskCounts(initial);

  const save = useCallback(async () => {
    if (testDataOn) {
      setMessage('Disabled in test-data mode');
      return;
    }
    setSaving(true);
    setMessage(null);
    const body: UpdateProjectRequest = {
      name: name.trim(),
      default_branch: defaultBranch.trim() || 'main',
      repo_url: repoUrl.trim() === '' ? null : repoUrl.trim(),
    };
    try {
      const res = await fetch(`/api/projects/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setMessage('Saved');
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [testDataOn, name, repoUrl, defaultBranch, initial.id, onSaved]);

  const setArchived = useCallback(
    async (nextArchived: boolean) => {
      if (testDataOn) {
        setMessage('Disabled in test-data mode');
        return;
      }
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/projects/${initial.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archived: nextArchived }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Update failed');
        onSaved();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Update failed');
      } finally {
        setSaving(false);
      }
    },
    [testDataOn, initial.id, onSaved],
  );

  return (
    <>
      <dl className="overview-detail-facts project-detail-facts">
        <div>
          <dt>ID</dt>
          <dd className="spec-mono">{initial.id}</dd>
        </div>
        <div>
          <dt>Active threads</dt>
          <dd>{initial.active_threads ?? 0}</dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>{counts.ready}</dd>
        </div>
        <div>
          <dt>In progress</dt>
          <dd>{counts.in_progress}</dd>
        </div>
        <div>
          <dt>Review</dt>
          <dd>{counts.review}</dd>
        </div>
        <div>
          <dt>Merge</dt>
          <dd>{counts.merge}</dd>
        </div>
        <div>
          <dt>Waiting</dt>
          <dd>{counts.waiting}</dd>
        </div>
        <div>
          <dt>Backlog</dt>
          <dd>{counts.backlog}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd className="spec-mono">{new Date(initial.created_at).toLocaleString()}</dd>
        </div>
        {archived && initial.archived_at ? (
          <div>
            <dt>Archived</dt>
            <dd className="spec-mono">{new Date(initial.archived_at).toLocaleString()}</dd>
          </div>
        ) : null}
      </dl>

      <div className="project-detail-form">
        <label className="form-field form-field-full">
          <span className="form-label">Name</span>
          <input
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={testDataOn}
          />
        </label>
        <label className="form-field form-field-full">
          <span className="form-label">Repository (HTTPS, optional)</span>
          <input
            type="url"
            className="form-input spec-mono"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/org/repo.git"
            disabled={testDataOn}
          />
        </label>
        <p className="project-form-hint">
          Private HTTPS repos authenticate via the <code className="spec-mono">GIT_PAT</code> vault
          key on each worker.
        </p>
        <label className="form-field form-field-full">
          <span className="form-label">Default branch</span>
          <input
            type="text"
            className="form-input spec-mono"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            disabled={testDataOn}
          />
        </label>
      </div>

      <div className="overview-item-actions project-item-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => void save()}
          disabled={saving || testDataOn}
        >
          {saving ? '…' : 'Save'}
        </button>
        {archived ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void setArchived(false)}
            disabled={saving || testDataOn}
          >
            Restore
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void setArchived(true)}
            disabled={saving || testDataOn}
          >
            Archive
          </button>
        )}
        {message ? <span className="project-save-msg">{message}</span> : null}
      </div>
    </>
  );
}

function ProjectSection({
  id,
  label,
  items,
  muted,
  testDataOn,
  onSaved,
  onReorder,
  emptyMessage,
  collections,
  onToggle,
}: {
  id: string;
  label: string;
  items: Project[];
  muted?: boolean;
  testDataOn: boolean;
  onSaved: () => void;
  onReorder: (next: Project[]) => void;
  emptyMessage?: string;
  collections: CollectionSummary[];
  onToggle: (collectionId: string, projectId: string, include: boolean) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const draggingId = useRef<string | null>(null);

  return (
    <section className="overview-section" aria-labelledby={id}>
      <h2 id={id} className="overview-section-label">
        {label}
      </h2>
      {items.length === 0 ? (
        <p className="empty-state">{emptyMessage ?? 'Nothing here yet.'}</p>
      ) : (
        <ul className={`overview-list project-list${muted ? ' overview-list-muted' : ''}`}>
          {items.map((project) => {
            const expanded = expandedId === project.id;
            return (
              <li
                key={project.id}
                className={`overview-item project-row${expanded ? ' is-expanded' : ''}${overId === project.id ? ' is-drop-target' : ''}`}
                onDragOver={(event) => {
                  if (!draggingId.current) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setOverId(project.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const fromId = draggingId.current || event.dataTransfer.getData('text/plain');
                  draggingId.current = null;
                  setOverId(null);
                  if (!fromId || fromId === project.id) return;
                  onReorder(moveProject(items, fromId, project.id));
                }}
              >
                <div className="project-row-head">
                  <button
                    type="button"
                    className="project-grab"
                    draggable={!testDataOn}
                    aria-label={`Reorder ${project.name}`}
                    disabled={testDataOn}
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={(event) => {
                      draggingId.current = project.id;
                      event.dataTransfer.setData('text/plain', project.id);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      draggingId.current = null;
                      setOverId(null);
                    }}
                  >
                    <GripIcon />
                  </button>
                  <div className="project-row-summary">
                    <button
                      type="button"
                      className="overview-item-trigger"
                      aria-expanded={expanded}
                      aria-controls={`project-detail-${project.id}`}
                      onClick={() => setExpandedId(expanded ? null : project.id)}
                    >
                      <span className="overview-item-body">
                        <span className="overview-item-kind">Project</span>
                        <span className="overview-item-title">{project.name}</span>
                        <span className="overview-item-meta spec-mono">{repoMeta(project)}</span>
                      </span>
                      <span className="overview-item-end">
                        <ProjectBadges project={project} muted={muted} />
                        <span className="overview-chevron" aria-hidden="true" />
                      </span>
                    </button>
                    {collections.length > 0 && !testDataOn ? (
                      <div className="collection-toggles">
                        {collections.map((collection) => {
                          const included = collection.project_ids.includes(project.id);
                          return (
                            <button
                              key={collection.id}
                              type="button"
                              className={`btn btn-sm${included ? ' btn-primary' : ''}`}
                              aria-pressed={included}
                              onClick={() => onToggle(collection.id, project.id, !included)}
                            >
                              {collection.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div
                  id={`project-detail-${project.id}`}
                  className="overview-item-detail"
                  hidden={!expanded}
                >
                  <ProjectRow
                    project={project}
                    testDataOn={testDataOn}
                    onSaved={onSaved}
                    archived={muted}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ProjectsClient() {
  const { useTestData: testDataOn } = useTestData();
  const { data, loading, refresh } = useJsonFetch<{ projects: Project[] }>(
    '/api/projects?include_archived=1',
    0,
    !testDataOn,
  );
  const { active, collections, loaded: collectionsLoaded, refresh: refreshCollections, toggleProject } = useCollections();
  const [createOpen, setCreateOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [ordered, setOrdered] = useState<Project[] | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [collectionError, setCollectionError] = useState<string | null>(null);

  useEffect(() => {
    setOrdered(null);
  }, [data, active?.id]);

  const allProjects = testDataOn ? TEST_PROJECTS : (ordered ?? data?.projects ?? []);
  const visibleProjects = useMemo(() => {
    if (testDataOn || ordered || !active) return allProjects;
    return projectsInCollection(allProjects, active);
  }, [active, allProjects, ordered, testDataOn]);
  const activeProjects = useMemo(() => visibleProjects.filter((p) => !p.archived), [visibleProjects]);
  const archivedProjects = useMemo(() => visibleProjects.filter((p) => p.archived), [visibleProjects]);

  const saved = useCallback(() => {
    void refresh();
    void refreshCollections();
  }, [refresh, refreshCollections]);

  const handleToggle = useCallback(
    (collectionId: string, projectId: string, include: boolean) => {
      setCollectionError(null);
      void toggleProject(collectionId, projectId, include).catch((err: unknown) => {
        setCollectionError(err instanceof Error ? err.message : 'Failed to update the collection');
      });
    },
    [toggleProject],
  );

  const handleReorder = useCallback(
    async (nextSection: Project[]) => {
      const nextAll = placeSection(visibleProjects, nextSection);
      setOrdered(nextAll);
      setReorderError(null);
      if (testDataOn) return;
      try {
        // D-005
        const url = active ? `/api/collections/${encodeURIComponent(active.id)}/order` : '/api/projects/order';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: nextSection.map((project) => project.id) }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Failed to reorder projects');
        if (active) await refreshCollections();
        else await refresh();
      } catch (err) {
        setOrdered(null);
        setReorderError(err instanceof Error ? err.message : 'Failed to reorder projects');
      }
    },
    [active, refresh, refreshCollections, testDataOn, visibleProjects],
  );

  return (
    <AppShell>
      <div className="main-padded">
        <div className="projects-page-header">
          <p className="page-lead project-page-lead">
            Register projects and optionally link an HTTPS git repository. Default branch pre-fills
            the New Thread form. Projects without a repo cannot spawn threads yet.
          </p>
          <div className="projects-page-actions">
            {testDataOn ? null : (
              // D-006
              <button type="button" className="btn" onClick={() => setCollectionsOpen(true)}>
                Collections
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
              New project
            </button>
          </div>
        </div>
        {!testDataOn && collectionsLoaded && collections.length === 0 ? (
          <p className="form-help">Open Collections to create one, then press its name on a project.</p>
        ) : null}
        {collectionError ? <p className="form-error">{collectionError}</p> : null}
        {reorderError ? <p className="modal-error">{reorderError}</p> : null}

        {loading && allProjects.length === 0 && !testDataOn ? (
          <p className="empty-state">Loading projects…</p>
        ) : (
          <div className="projects-page">
            <ProjectSection
              id="active-projects-heading"
              label="Active"
              items={activeProjects}
              testDataOn={testDataOn}
              onSaved={saved}
              onReorder={(next) => void handleReorder(next)}
              collections={testDataOn ? [] : collections}
              onToggle={handleToggle}
              emptyMessage={
                testDataOn
                  ? undefined
                  : active
                    ? `No projects in ${active.name}. Choose All and press the collection name on a project.`
                    : 'No projects yet. Create one to use in New Thread.'
              }
            />
            <ProjectSection
              id="archived-projects-heading"
              label="Archived"
              items={archivedProjects}
              muted
              testDataOn={testDataOn}
              onSaved={saved}
              onReorder={(next) => void handleReorder(next)}
              collections={testDataOn ? [] : collections}
              onToggle={handleToggle}
              emptyMessage="Archived projects are hidden from New Thread."
            />
          </div>
        )}

      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={saved}
        testDataOn={testDataOn}
      />
      <CollectionsModal open={collectionsOpen} onClose={() => setCollectionsOpen(false)} />
    </AppShell>
  );
}
