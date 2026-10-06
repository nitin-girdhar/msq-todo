'use client';

import type { SessionUser } from '@platform/types';
import { FilterField } from '@platform/ui-kit';
import { TASK_PRIORITY_OPTIONS, TASK_STATUS_OPTIONS } from '../../lib/tasks/format';
import type { TaskPriorityName, TaskListView, TaskStatusName } from '../../lib/tasks/types';
import { EMPTY_TASK_FILTERS, type TaskBoardFilters } from '../../hooks/useTaskBoard';

// One control height / look for every select and input in the bar, so the row
// lines up with the neighbouring MultiSelect-style fields (34px).
export const CONTROL_CLASS =
  'h-[34px] min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

interface Props {
  filters: TaskBoardFilters;
  assignableUsers: SessionUser[];
  lists: TaskListView[];
  onChange: (patch: Partial<TaskBoardFilters>) => void;
  /** Total matching rows, shown next to "Show completed" (Stitch: "Show completed (4)"). */
  completedCount?: number | undefined;
}

export default function TaskFilterBar({ filters, assignableUsers, lists, onChange, completedCount }: Props) {
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_TASK_FILTERS);

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
      <FilterField label="Search">
        <input
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ q: e.target.value })}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className={`${CONTROL_CLASS} w-44 sm:w-56`}
        />
      </FilterField>

      <FilterField label="Assignee">
        <select
          value={filters.unassigned ? '__none__' : filters.assigneeId}
          onChange={(e) =>
            e.target.value === '__none__'
              ? onChange({ unassigned: true, assigneeId: '' })
              : onChange({ unassigned: false, assigneeId: e.target.value })
          }
          aria-label="Filter by assignee"
          className={CONTROL_CLASS}
        >
          <option value="">All assignees</option>
          <option value="__none__">Unassigned</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Status">
        <select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as TaskStatusName | '' })}
          aria-label="Filter by status"
          className={CONTROL_CLASS}
        >
          <option value="">All statuses</option>
          {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FilterField>

      <FilterField label="Priority">
        <select
          value={filters.priority}
          onChange={(e) => onChange({ priority: e.target.value as TaskPriorityName | '' })}
          aria-label="Filter by priority"
          className={CONTROL_CLASS}
        >
          <option value="">All priorities</option>
          {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </FilterField>

      <FilterField label="List">
        <select
          value={filters.listId}
          onChange={(e) => onChange({ listId: e.target.value })}
          aria-label="Filter by list"
          className={CONTROL_CLASS}
        >
          <option value="">All lists</option>
          {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </FilterField>

      <label className="flex h-[34px] items-center gap-1.5 text-xs text-on-surface-variant">
        <input
          type="checkbox"
          checked={filters.includeCompleted}
          onChange={(e) => onChange({ includeCompleted: e.target.checked })}
          className="accent-primary"
        />
        Show completed{typeof completedCount === 'number' ? ` (${completedCount})` : ''}
      </label>

      {dirty && (
        <button
          type="button"
          onClick={() => onChange({ ...EMPTY_TASK_FILTERS })}
          className="h-[34px] rounded-lg px-2 text-xs font-semibold text-primary hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
