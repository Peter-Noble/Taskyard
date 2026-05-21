import { getDb, listMachines, listProjects, listThreads } from '@taskyard/core';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

function statusClass(status: string): string {
  const map: Record<string, string> = {
    online: styles.statusOnline,
    offline: styles.statusOffline,
    busy: styles.statusBusy,
    running: styles.statusRunning,
    pending: styles.statusPending,
    spawning: styles.statusPending,
    completed: styles.statusCompleted,
    error: styles.statusError,
    closed: styles.statusClosed,
  };
  return map[status] ?? styles.statusOffline;
}

export default function HomePage() {
  const db = getDb();
  const machines = listMachines(db);
  const threads = listThreads(db);
  const projects = listProjects(db);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>Taskyard</h1>
        <p className={styles.subtitle}>Agent orchestrator dashboard</p>
      </header>

      <section className={styles.section}>
        <h2>Workers ({machines.length})</h2>
        {machines.length === 0 ? (
          <p className={styles.empty}>
            No workers connected. Start one with{' '}
            <code>pnpm dev:worker -- --hub ws://localhost:3001</code>
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>CPU</th>
                <th>RAM</th>
                <th>Threads</th>
                <th>Ports</th>
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>
                    <span className={statusClass(m.status)}>{m.status}</span>
                  </td>
                  <td>
                    {m.cpu_percent != null ? `${m.cpu_percent.toFixed(1)}%` : '—'}
                    {m.cpu_cores != null ? ` / ${m.cpu_cores}c` : ''}
                  </td>
                  <td>
                    {m.ram_used_gb != null ? `${m.ram_used_gb.toFixed(1)}` : '—'}
                    {m.ram_gb != null ? ` / ${m.ram_gb} GB` : ''}
                  </td>
                  <td>{m.active_threads ?? 0}</td>
                  <td>
                    {m.port_utilization
                      ? `${m.port_utilization.used}/${m.port_utilization.total}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2>Threads ({threads.length})</h2>
        {threads.length === 0 ? (
          <p className={styles.empty}>
            No threads yet. Create one via{' '}
            <code>POST /api/threads</code> or the TUI (Phase 5).
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Project</th>
                <th>Agent</th>
                <th>Branch</th>
                <th>Status</th>
                <th>Machine</th>
                <th>Ports</th>
              </tr>
            </thead>
            <tbody>
              {threads.map((t) => (
                <tr key={t.id}>
                  <td>{t.project_name ?? t.project_id.slice(0, 8)}</td>
                  <td>{t.agent_type}</td>
                  <td>{t.branch}</td>
                  <td>
                    <span className={statusClass(t.status)}>{t.status}</span>
                  </td>
                  <td>{t.machine_name ?? '—'}</td>
                  <td>
                    {t.web_port && t.vnc_port ? `${t.web_port} / ${t.vnc_port}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className={styles.section}>
        <h2>Projects ({projects.length})</h2>
        {projects.length === 0 ? (
          <p className={styles.empty}>
            Add entries to <code>projects.json</code> at the repo root, then restart the server.
          </p>
        ) : (
          <ul className={styles.projectList}>
            {projects.map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong> — {p.repo_url} ({p.default_branch})
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
