'use client';

import type { TaskView } from '../../lib/tasks/types';
import { formatDueDate, initialsOf, taskCode } from '../../lib/tasks/format';
import TaskPriorityBadge from './TaskPriorityBadge';
import TaskSlaChip from './TaskSlaChip';
import TaskStatusChip from './TaskStatusChip';

interface Props {
  task: TaskView;
  selected: boolean;
  /** Omit to hide the selection checkbox. */
  onToggle?: ((id: string) => void) | undefined;
  onOpen: (task: TaskView) => void;
}

// Phone task card (Stitch "My Tasks Hub" mobile). The whole card opens the task;
// every control is >=44px tall (responsive-audit tap-target rule). The checkbox
// sits outside the open button so ticking never opens the sheet.
export default function MobileTaskCard({ task, selected, onToggle, onOpen }: Props) {
  const overdue = task.sla_state === 'overdue';
  return (
    <article
      className={`mx-3 flex flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-card ${
        selected ? 'ring-2 ring-primary' : overdue ? 'ring-1 ring-status-overdue/40' : ''
      }`}
    >
      <div className="flex items-start gap-1 pr-2">
        {onToggle && (
          <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle(task.id)}
              aria-label={`Select ${task.title}`}
              className="h-4 w-4 accent-primary"
            />
          </label>
        )}
        <button
          type="button"
          onClick={() => onOpen(task)}
          className={`min-w-0 flex-1 py-3 text-left ${onToggle ? '' : 'pl-4'}`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="font-mono text-label-sm text-on-surface-variant">{taskCode(task.task_no)}</span>
            <TaskStatusChip status={task.status_name} label={task.status_label} />
          </span>
          <span className={`mt-1 block text-headline-sm ${task.status_is_terminal ? 'text-outline line-through' : 'text-on-surface'}`}>
            {task.title}
          </span>
          {task.description && (
            <span className="mt-0.5 line-clamp-2 block text-body-sm text-on-surface-variant">{task.description}</span>
          )}
        </button>
      </div>

      <dl className="mx-3 mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg bg-surface-container-low px-3 py-2 text-body-sm">
        <dt className="text-label-sm uppercase tracking-wider text-outline">List</dt>
        <dd className="truncate text-on-surface-variant">{task.list_name ?? 'No list'}</dd>
        <dt className="text-label-sm uppercase tracking-wider text-outline">Due</dt>
        <dd className="flex flex-wrap items-center gap-2">
          <span className={`tabular-nums ${overdue ? 'font-semibold text-status-overdue' : 'text-on-surface'}`}>{formatDueDate(task.due_at)}</span>
          <TaskSlaChip state={task.sla_state} />
        </dd>
        <dt className="text-label-sm uppercase tracking-wider text-outline">Priority</dt>
        <dd>{task.priority_name ? <TaskPriorityBadge priority={task.priority_name} label={task.priority_label} /> : <span className="text-outline">—</span>}</dd>
        <dt className="text-label-sm uppercase tracking-wider text-outline">Assignee</dt>
        <dd className="flex items-center gap-2">
          {task.assignee_name ? (
            <>
              <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-[0.5625rem] font-semibold text-on-primary-fixed-variant">
                {initialsOf(task.assignee_name)}
              </span>
              <span className="truncate text-on-surface">{task.assignee_name}</span>
            </>
          ) : (
            <span className="italic text-outline">Unassigned</span>
          )}
        </dd>
      </dl>
    </article>
  );
}
