'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { SessionUser } from '@platform/types';
import { tasks as tasksApi } from '../../lib/api/client';
import { taskCode } from '../../lib/tasks/format';
import type { TaskListView, TaskView } from '../../lib/tasks/types';
import TaskDetailPanel from './TaskDetailPanel';
import TaskSlaChip from './TaskSlaChip';
import TaskStatusChip from './TaskStatusChip';

interface Props {
  task: TaskView | null;
  lists: TaskListView[];
  assignableUsers: SessionUser[];
  actor: SessionUser;
  canAssign: boolean;
  canDelete: boolean;
  onClose: () => void;
  /** After a save or delete — the host refetches its list. */
  onChanged: () => void;
}

// Quick-edit overlay opened from a row / card / board tile. Escape closes it;
// clicking the dimmed backdrop does NOT — this is an edit form and a stray click
// outside must not discard unsaved changes. The full-page view lives at /tasks/[id].
export default function TaskDetailDrawer({ task, lists, assignableUsers, actor, canAssign, canDelete, onClose, onChanged }: Props) {
  // The drawer holds its own copy so a save shows the server's version at once;
  // a different task replaces it.
  const [current, setCurrent] = useState<TaskView | null>(task);
  useEffect(() => { setCurrent(task); }, [task]);

  const reload = useCallback(() => {
    if (!task) return;
    void tasksApi.get(task.id).then((res) => setCurrent(res.data)).catch(() => undefined);
  }, [task]);

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [task, onClose]);

  if (!task || !current) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-scrim" role="dialog" aria-modal="true" aria-label="Task detail">
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-surface-container-lowest p-5 shadow-overlay sm:p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h2 className="text-headline-sm text-on-surface">Task detail</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-label-md text-on-surface-variant">{taskCode(current.task_no)}</span>
              <TaskStatusChip status={current.status_name} label={current.status_label} />
              <TaskSlaChip state={current.sla_state} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={`/tasks/${current.id}`}
              className="rounded-lg px-2 py-1 text-label-md font-semibold text-primary hover:bg-primary-fixed/50"
            >
              Open page
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M4.28 4.28a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.66a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.66a.75.75 0 1 1-1.06 1.06L10 11.06l-4.66 4.66a.75.75 0 1 1-1.06-1.06L8.94 10 4.28 5.34a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        <TaskDetailPanel
          task={current}
          lists={lists}
          assignableUsers={assignableUsers}
          actor={actor}
          canAssign={canAssign}
          canDelete={canDelete}
          hideHeader
          onSaved={(updated) => { setCurrent(updated); onChanged(); onClose(); }}
          onDeleted={() => { onChanged(); onClose(); }}
          onReload={reload}
        />
      </div>
    </div>
  );
}
