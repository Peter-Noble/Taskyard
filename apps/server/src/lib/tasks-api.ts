/** Task API types per docs/mvp.md — used when /api/tasks is available. */

export type TaskStatus =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'review'
  | 'waiting'
  | 'completed'
  | 'cancelled';

export type ApiTask = {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string | null;
  created_at: string;
  updated_at: string;
};

export type ListTasksResponse = { tasks: ApiTask[] };

export async function fetchTasksForProject(projectId: string): Promise<ApiTask[] | null> {
  try {
    const res = await fetch(`/api/tasks?project_id=${encodeURIComponent(projectId)}`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = (await res.json()) as ListTasksResponse;
    return data.tasks ?? [];
  } catch {
    return null;
  }
}

/** True when the tasks list endpoint exists and responds successfully. */
export async function tasksApiAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/tasks');
    return res.ok;
  } catch {
    return false;
  }
}
