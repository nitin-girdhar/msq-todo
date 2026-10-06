'use client';

import Link from 'next/link';
import type { TaskSortKey, TaskView } from '../../lib/tasks/types';
import { formatDueDate, initialsOf, taskCode } from '../../lib/tasks/format';
import TaskPriorityBadge from './TaskPriorityBadge';
import TaskSlaChip from './TaskSlaChip';
import TaskStatusChip from './TaskStatusChip';

interface Props {
  tasks: TaskView[];
  /** Ids ticked for a bulk action. Omit `onToggle` to hide the checkbox column. */
  selected: ReadonlySet<string>;
  onToggle?: ((id: string) => void) | undefined;
  onToggleAll?: ((ids: string[], checked: boolean) => void) | undefined;
  sort: TaskSortKey;
  dir: 'asc' | 'desc';
  onSort: (key: TaskSortKey) => void;
  onOpen: (task: TaskView) => void;
  /** Show the branch under the list (team view across a user's covered branches). */
  showBranch?: boolean;
}

interface SortHeadProps {
  label: string;
  sortKey?: TaskSortKey;
  sort: TaskSortKey;
  dir: 'asc' | 'desc';
  onSort: (key: TaskSortKey) => void;
  className?: string;
}

// A header that sorts server-side. aria-sort lives on the <th>, not the button,
// so assistive tech announces the column's state rather than the control's.
function Head({ label, sortKey, sort, dir, onSort, className = '' }: SortHeadProps) {
  if (!sortKey) {
    return <th scope="col" className={`px-3 py-2.5 text-left text-label-sm font-semibold uppercase tracking-wider text-outline ${className}`}>{label}</th>;
  }
  const active = sort === sortKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`px-3 py-2.5 text-left ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-label-sm font-semibold uppercase tracking-wider hover:text-on-surface ${
          active ? 'text-on-surface' : 'text-outline'
        }`}
      >
        {label}
        <span aria-hidden className="text-[0.625rem]">{active ? (dir === 'asc' ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );
}

export default function TaskTable({ tasks, selected, onToggle, onToggleAll, sort, dir, onSort, onOpen, showBranch }: Props) {
  const selectable = onToggle !== undefined;
  const allIds = tasks.map((t) => t.id);
  const allChecked = tasks.length > 0 && allIds.every((id) => selected.has(id));
  const head = { sort, dir, onSort };

  return (
    <div className="overflow-x-auto rounded-xl bg-surface-container-lowest shadow-card">
      <table className="w-full min-w-[960px] text-body-sm">
        <thead className="border-b border-outline-variant bg-surface-container-low">
          <tr>
            {selectable && (
              <th scope="col" className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all tasks on this page"
                  checked={allChecked}
                  onChange={(e) => onToggleAll?.(allIds, e.target.checked)}
                  className="accent-primary"
                />
              </th>
            )}
            <Head label="Code" sortKey="task_no" {...head} />
            <Head label="Task" sortKey="title" {...head} />
            <Head label="List" {...head} />
            <Head label="Priority" sortKey="priority" {...head} />
            <Head label="Status" sortKey="status" {...head} />
            <Head label="SLA / due" sortKey="due_at" {...head} />
            <Head label="Assignee" {...head} />
            <th scope="col" className="w-12 px-3 py-2.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const isSelected = selected.has(t.id);
            const overdue = t.sla_state === 'overdue';
            return (
              <tr
                key={t.id}
                onClick={() => onOpen(t)}
                className={`cursor-pointer border-b border-outline-variant/60 last:border-0 hover:bg-surface-container-low ${
                  isSelected ? 'bg-primary-fixed/40' : overdue ? 'bg-status-overdue-container/30' : ''
                }`}
              >
                {selectable && (
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={`Select ${t.title}`}
                      checked={isSelected}
                      onChange={() => onToggle?.(t.id)}
                      className="accent-primary"
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-label-sm text-on-surface-variant">{taskCode(t.task_no)}</td>
                <td className="max-w-xs px-3 py-2.5">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpen(t); }}
                    className="block w-full text-left"
                  >
                    <span className={`block truncate font-medium ${t.status_is_terminal ? 'text-outline line-through' : 'text-on-surface'}`}>
                      {t.title}
                    </span>
                    {t.description && (
                      <span className="block truncate text-label-sm text-on-surface-variant">{t.description}</span>
                    )}
                  </button>
                </td>
                <td className="max-w-[10rem] px-3 py-2.5 text-on-surface-variant">
                  <span className="block truncate">{t.list_name ?? 'No list'}</span>
                  {showBranch && t.org_name && <span className="block truncate text-label-sm text-outline">{t.org_name}</span>}
                </td>
                <td className="px-3 py-2.5">
                  {t.priority_name ? <TaskPriorityBadge priority={t.priority_name} label={t.priority_label} /> : <span className="text-outline">—</span>}
                </td>
                <td className="px-3 py-2.5"><TaskStatusChip status={t.status_name} label={t.status_label} /></td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className={`block tabular-nums ${overdue ? 'font-semibold text-status-overdue' : 'text-on-surface-variant'}`}>
                    {formatDueDate(t.due_at)}
                  </span>
                  <TaskSlaChip state={t.sla_state} />
                </td>
                <td className="px-3 py-2.5">
                  {t.assignee_name ? (
                    <span className="flex items-center gap-2">
                      <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-[0.625rem] font-semibold text-on-primary-fixed-variant">
                        {initialsOf(t.assignee_name)}
                      </span>
                      <span className="truncate text-on-surface">{t.assignee_name}</span>
                    </span>
                  ) : (
                    <span className="italic text-outline">Unassigned</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/tasks/${t.id}`}
                    aria-label={`Open ${t.title} on its own page`}
                    title="Open full page"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18v4.5M18 6l-7.5 7.5M10 6H6.5A1.5 1.5 0 005 7.5v10A1.5 1.5 0 006.5 19h10a1.5 1.5 0 001.5-1.5V14" />
                    </svg>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
