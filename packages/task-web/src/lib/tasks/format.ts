// Pure tasks-module helpers — no React, no I/O. Shared by the tasks composites
// and the server pages. Rank gating itself lives in @task/authz
// (canViewTeamTasks / canViewOrgTasks / canAdministerTasks), already built
// specifically for tasks — imported directly by callers rather than re-derived
// here.
//
// Colours are theme tokens only (skills/react-typescript §6): urgency uses the
// fixed `status-*` roles so "overdue is red" reads the same for every tenant;
// categorical chips use the fixed `cat-*` roles. Never the tenant brand.

import type {
  DueBucket,
  TaskPriorityName,
  TaskSlaState,
  TaskStatusName,
  TaskVisibility,
} from './types';

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Classifies a task's due_at into a display bucket, relative to local "today". */
export function dueBucket(dueAt: string | null): DueBucket {
  if (!dueAt) return 'none';
  const due = startOfDay(new Date(dueAt));
  const today = startOfDay(new Date());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 7) return 'week';
  return 'later';
}

export const DUE_BUCKET_LABELS: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
  none: 'No due date',
};

export const DUE_BUCKET_ORDER: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none'];

/** End-of-today as an ISO datetime with offset, for due_before filters. */
export function endOfTodayISO(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

export function formatDueDate(iso: string | null): string {
  if (!iso) return 'No due date';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * A `<input type="date">` value (YYYY-MM-DD) -> the due_at we store: the END of
 * that day in the user's own timezone. The SLA state is derived from due_at on the
 * server, so a task due "today" must not read as overdue at 00:00 — it is due
 * until the day ends. (The old UTC-midnight anchor made today's tasks overdue from
 * 05:30 IST.) Empty -> null.
 */
export function dueDateToISO(date: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59).toISOString();
}

/** due_at -> the `<input type="date">` value, read in the user's timezone so it
 * round-trips with dueDateToISO. */
export function isoToDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Today's date as a `<input type="date">` value (local). */
export function todayDateInput(): string {
  return isoToDateInput(new Date().toISOString());
}

/** The human code shown for a task: TASK-904. Unique per branch. */
export function taskCode(taskNo: number | null | undefined): string {
  return taskNo ? `TASK-${taskNo}` : 'TASK-—';
}

/** Two-letter initials for an assignee avatar. */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

// Status chip palette: soft container + its paired "on" colour.
export const TASK_STATUS_STYLES: Record<TaskStatusName, { bg: string; fg: string; dot: string }> = {
  todo: { bg: 'bg-cat-slate-container', fg: 'text-on-cat-slate-container', dot: 'bg-cat-slate' },
  in_progress: { bg: 'bg-status-info-container', fg: 'text-on-status-info-container', dot: 'bg-status-info' },
  blocked: { bg: 'bg-status-overdue-container', fg: 'text-on-status-overdue-container', dot: 'bg-status-overdue' },
  done: { bg: 'bg-status-success-container', fg: 'text-on-status-success-container', dot: 'bg-status-success' },
  cancelled: { bg: 'bg-cat-slate-container', fg: 'text-on-cat-slate-container', dot: 'bg-outline' },
};

export const TASK_PRIORITY_STYLES: Record<TaskPriorityName, { bg: string; fg: string }> = {
  low: { bg: 'bg-cat-slate-container', fg: 'text-on-cat-slate-container' },
  medium: { bg: 'bg-status-info-container', fg: 'text-on-status-info-container' },
  high: { bg: 'bg-status-due-container', fg: 'text-on-status-due-container' },
  urgent: { bg: 'bg-status-overdue-container', fg: 'text-on-status-overdue-container' },
};

// SLA chip. `none` (no due date, or finished) renders nothing.
export const TASK_SLA_STYLES: Record<Exclude<TaskSlaState, 'none'>, { bg: string; fg: string; label: string }> = {
  overdue: { bg: 'bg-status-overdue-container', fg: 'text-on-status-overdue-container', label: 'Overdue' },
  due_soon: { bg: 'bg-status-due-container', fg: 'text-on-status-due-container', label: 'Due soon' },
  ok: { bg: 'bg-status-success-container', fg: 'text-on-status-success-container', label: 'On track' },
};

export const TASK_STATUS_OPTIONS: { value: TaskStatusName; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const TASK_PRIORITY_OPTIONS: { value: TaskPriorityName; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// A branch IS an organization here, so the stored value stays `org`; only the
// label says "Branch" (the Stitch "Branch scoped" tier). `branchWord` carries the
// tenant's own term for it (useTerm('branch')), so a tenant that calls branches
// "Studios" sees that instead.
export function taskVisibilityOptions(
  branchWord = 'Branch',
): { value: TaskVisibility; label: string; help: string }[] {
  return [
    { value: 'private', label: 'Private', help: 'Only you can see this list.' },
    { value: 'team', label: 'Team', help: 'You and everyone who reports up to you.' },
    { value: 'org', label: branchWord, help: `Everyone in this ${branchWord.toLowerCase()}.` },
  ];
}

export function visibilityLabel(v: TaskVisibility, branchWord = 'Branch'): string {
  return taskVisibilityOptions(branchWord).find((o) => o.value === v)?.label ?? v;
}

/** A task is visibly "overdue" for row/table highlighting: has a due date in
 * the past and hasn't reached a terminal status. */
export function isOverdue(dueAt: string | null, statusIsTerminal: boolean): boolean {
  if (!dueAt || statusIsTerminal) return false;
  return dueBucket(dueAt) === 'overdue';
}
