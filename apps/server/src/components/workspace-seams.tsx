'use client';

import { useState, type ReactNode } from 'react';
import {
  DEFAULT_PANEL_VISIBILITY,
  writePanelVisibility,
  type PanelVisibility,
} from '@/lib/panel-visibility';

type WorkspaceSeamsProps = {
  initialPanels?: PanelVisibility;
  taskHead: ReactNode;
  taskBody: ReactNode;
  streamHead: ReactNode;
  streamBody: ReactNode;
  threadHead: ReactNode;
  threadBody: ReactNode;
  workers: ReactNode;
};

function Center({ head, body }: { head: ReactNode; body: ReactNode }) {
  return (
    <div className="workspace-center">
      {head ? <div className="workspace-slot-head">{head}</div> : null}
      <div className="workspace-slot-body">{body}</div>
    </div>
  );
}

function OpenRail({
  side,
  head,
  body,
  onHide,
}: {
  side: 'tasks' | 'threads';
  head: ReactNode;
  body: ReactNode;
  onHide: () => void;
}) {
  const label = side === 'tasks' ? 'Hide tasks' : 'Hide threads';
  return (
    <div className={`workspace-rail-wrap workspace-rail-${side}`}>
      <div className="workspace-rail">
        <div className="workspace-slot-head">{head}</div>
        <div className="workspace-slot-body">{body}</div>
      </div>
      <button
        type="button"
        className={`workspace-seam workspace-seam-${side === 'tasks' ? 'right' : 'left'}`}
        aria-label={label}
        onClick={onHide}
      >
        {side === 'tasks' ? '‹' : '›'}
      </button>
    </div>
  );
}

export function WorkspaceSeams({
  initialPanels = DEFAULT_PANEL_VISIBILITY,
  taskHead,
  taskBody,
  streamHead,
  streamBody,
  threadHead,
  threadBody,
  workers,
}: WorkspaceSeamsProps) {
  const [open, setOpen] = useState(initialPanels);

  function toggle(key: keyof PanelVisibility) {
    const next = { ...open, [key]: !open[key] };
    setOpen(next);
    writePanelVisibility(next);
  }

  return (
    <div className="workspace-seams">
      <div className="workspace-seams-columns">
        {open.tasks ? (
          <OpenRail side="tasks" head={taskHead} body={taskBody} onHide={() => toggle('tasks')} />
        ) : (
          <button type="button" className="workspace-strip workspace-strip-left" onClick={() => toggle('tasks')}>
            Tasks
          </button>
        )}
        <Center head={streamHead} body={streamBody} />
        {open.threads ? (
          <OpenRail side="threads" head={threadHead} body={threadBody} onHide={() => toggle('threads')} />
        ) : (
          <button type="button" className="workspace-strip workspace-strip-right" onClick={() => toggle('threads')}>
            Threads
          </button>
        )}
      </div>
      {open.workers ? (
        <div className="workspace-workers">
          <button
            type="button"
            className="workspace-seam workspace-seam-top"
            aria-label="Hide workers"
            onClick={() => toggle('workers')}
          >
            ▾
          </button>
          {workers}
        </div>
      ) : (
        <button type="button" className="workspace-strip workspace-strip-bottom" onClick={() => toggle('workers')}>
          Workers
        </button>
      )}
    </div>
  );
}
