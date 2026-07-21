'use client';

import type { TaskView } from '../../lib/tasks/types';
import { TASK_STATUS_OPTIONS, formatDueDate, isOverdue } from '../../lib/tasks/format';
import TaskPriorityBadge from './TaskPriorityBadge';

interface Props {
  task: TaskView;
  onOpen: (task: TaskView) => void;
  onStatusChange: (task: TaskView, status: string) => void;
}

export default function TaskRow({ task, onOpen, onStatusChange }: Props) {
  const overdue = isOverdue(task.due_at, task.status_is_terminal);

  // Two-line stack below sm, one line from sm up. The old single flex-wrap row
  // kept the badge, the w-24 due date and the status select on one line at every
  // width, so the title — the only thing that identifies the task — collapsed to
  // roughly 90px of ellipsis on a phone.
  return (
    <div
      className={`border-b border-[#F1F5F9] px-4 py-2.5 last:border-0 hover:bg-[#F8FAFC] ${
        overdue ? 'bg-red-50/40' : ''
      }`}
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
        <button
          type="button"
          onClick={() => onOpen(task)}
          className="min-w-0 flex-1 text-left"
        >
          <span className={`block truncate text-sm font-medium ${task.status_is_terminal ? 'text-[#94A3B8] line-through' : 'text-[#0F172A]'}`}>
            {task.title}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[#94A3B8]">
            {task.list_name ?? 'No list'}
            {task.assignee_name ? ` · ${task.assignee_name}` : ''}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {task.priority_name && <TaskPriorityBadge priority={task.priority_name} label={task.priority_label} />}

          <span className={`shrink-0 text-xs tabular-nums sm:w-20 sm:text-right ${overdue ? 'font-semibold text-red-600' : 'text-[#64748B]'}`}>
            {formatDueDate(task.due_at)}
          </span>

          <select
            value={task.status_name}
            onChange={(e) => onStatusChange(task, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Status for ${task.title}`}
            className="ml-auto shrink-0 rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-xs text-[#0F172A] focus:border-[#0b6cbf] focus:outline-none focus:ring-2 focus:ring-[#0b6cbf]/20 sm:ml-0"
          >
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
