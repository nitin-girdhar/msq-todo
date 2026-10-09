// ─────────────────────────────────────────────────────────────────────────────
// Tasks service — authorization, visibility resolution, activity logging and
// assignee notifications. No SQL here (all DB access is in tasks.repository);
// no req/res (that is the controller).
//
// Visibility model (see Architecture.md "Tasks"):
//   * own tasks (created_by or assignee) are always visible/editable-by-owner.
//   * a task's list visibility governs who else may see it — private (owner only,
//     even to admins), team (owner + owner's subtree + admins), org (whole org).
//   * standalone tasks (no list) are visible to managers of the creator/assignee
//     (rank ≥ 60) and org admins (rank ≥ 80).
// ─────────────────────────────────────────────────────────────────────────────

import { logActivity } from '@platform/audit-log';
import { canViewTeamTasks, canViewOrgTasks, canAdministerTasks, canAssignTasks } from '@task/authz';
import { AppError, ForbiddenError, NotFoundError } from '../../../lib/errors.js';
import { publishTaskEvent } from '../../../lib/events.js';
import { toCsv } from '../../../lib/csv.js';
import * as repo from './tasks.repository.js';
import type { TaskCtx, TaskRow } from './tasks.repository.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksInput,
  ListMineTasksInput,
  ExportTasksInput,
  TaskStatsInput,
  BulkUpdateTasksInput,
} from '@task/validation';

// ── Visibility / authorization ──────────────────────────────────────────────
async function canViewTask(ctx: TaskCtx, row: TaskRow): Promise<boolean> {
  const me = ctx.user_id;
  if (row.created_by === me || row.assignee_id === me) return true;

  // Others' private list → hidden, even to org admins.
  if (row.list_visibility === 'private') return row.list_owner_id === me;

  if (row.list_visibility === 'org') return true;

  if (row.list_visibility === 'team') {
    if (row.list_owner_id === me) return true;
    if (canAdministerTasks(ctx)) return true;
    if (await repo.isManagerOf(ctx, row.list_owner_id!, me)) return true;
  }

  // Standalone (no list) or team-without-list-authority: managers of the
  // creator/assignee and org admins may see non-private tasks.
  if (canAdministerTasks(ctx)) return true;
  if (
    canViewTeamTasks(ctx) &&
    ((await repo.isManagerOf(ctx, me, row.created_by)) || (await repo.isManagerOf(ctx, me, row.assignee_id)))
  ) {
    return true;
  }
  return false;
}

function canEditTask(ctx: TaskCtx, row: TaskRow): Promise<boolean> | boolean {
  const me = ctx.user_id;
  if (canAdministerTasks(ctx)) return true; // rank ≥ 80
  if (row.created_by === me || row.assignee_id === me) return true;
  // rank ≥ 60 over the assignee.
  if (canViewTeamTasks(ctx)) return repo.isManagerOf(ctx, me, row.assignee_id);
  return false;
}

async function loadVisible(ctx: TaskCtx, id: string): Promise<TaskRow> {
  const row = await repo.getTaskRow(ctx, id);
  if (!row) throw new NotFoundError('Task not found');
  if (!(await canViewTask(ctx, row))) throw new NotFoundError('Task not found');
  return row;
}

// The team / org scopes are gated by capability; `own` is open to every holder of
// tasks.view. Shared by list, stats and export so they cannot drift apart.
function assertScopeAllowed(ctx: TaskCtx, scope: 'own' | 'team' | 'org'): void {
  if (scope === 'team' && !canViewTeamTasks(ctx)) {
    throw new ForbiddenError('Insufficient rank for the team task scope');
  }
  if (scope === 'org' && !canViewOrgTasks(ctx)) {
    throw new ForbiddenError('Insufficient rank for the org task scope');
  }
}

// ── Reads ──────────────────────────────────────────────────────────────────
export async function listTasks(ctx: TaskCtx, filters: ListTasksInput) {
  assertScopeAllowed(ctx, filters.scope);
  return repo.listTasks(ctx, filters);
}

export async function getTaskStats(ctx: TaskCtx, input: TaskStatsInput) {
  assertScopeAllowed(ctx, input.scope);
  return repo.getTaskStats(ctx, input);
}

const EXPORT_HEADERS = [
  'Task', 'Title', 'Description', 'List', 'Status', 'Priority', 'SLA', 'Due',
  'Assignee', 'Created by', 'Tags', 'Created', 'Completed',
] as const;

const SLA_LABEL: Record<string, string> = {
  overdue: 'Overdue', due_soon: 'Due within 24h', ok: 'On track', none: '',
};

// Timestamps leave the driver as strings like "2026-10-02 17:34:54+00", which
// spreadsheets mis-parse. ISO 8601 (UTC) opens as a date everywhere.
function isoOrBlank(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(value as string | number | Date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

// The caller's own visibility rules apply exactly as on the grid (same repository
// scope runner); the export capability only decides whether they may download.
export async function exportTasksCsv(ctx: TaskCtx, filters: ExportTasksInput) {
  assertScopeAllowed(ctx, filters.scope);
  const { rows, truncated } = await repo.listTasksForExport(ctx, filters);
  const csv = toCsv(
    EXPORT_HEADERS,
    rows.map((r) => [
      `TASK-${String(r['task_no'])}`, r['title'], r['description'], r['list_name'],
      r['status_label'], r['priority_label'], SLA_LABEL[String(r['sla_state'])] ?? '', isoOrBlank(r['due_at']),
      r['assignee_name'], r['created_by_name'], r['tags'], isoOrBlank(r['created_at']), isoOrBlank(r['completed_at']),
    ]),
  );
  void logActivity({
    action_type: 'tasks_exported',
    performed_by: ctx.user_id,
    org_id: ctx.org_id,
    new_value: { scope: filters.scope, rows: rows.length, truncated },
  });
  return { csv, truncated, count: rows.length };
}

export async function listMine(ctx: TaskCtx, filters: ListMineTasksInput) {
  return repo.listMine(ctx, filters);
}

export async function getTask(ctx: TaskCtx, id: string) {
  await loadVisible(ctx, id);
  return repo.getTaskView(ctx, id);
}

// ── Writes ───────────────────────────────────────────────────────────────────
// Handing a task to someone else is an assignment, whatever endpoint does it:
// create, edit and bulk all require tasks.assign. Taking a task yourself does not.
function assertCanAssign(ctx: TaskCtx): void {
  if (!canAssignTasks(ctx)) throw new ForbiddenError('You do not have permission to assign tasks');
}

export async function createTask(ctx: TaskCtx, data: CreateTaskInput) {
  if (data.assignee_id && data.assignee_id !== ctx.user_id) assertCanAssign(ctx);
  const result = await repo.createTask(ctx, data);
  if (result.assignee_id && result.assignee_id !== ctx.user_id) {
    void publishTaskEvent({
      type: 'task:assigned',
      task_id: result.id,
      recipient_id: result.assignee_id,
      org_id: ctx.org_id,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
    });
  }
  void logActivity({
    action_type: 'task_created',
    performed_by: ctx.user_id,
    subject_user_id: result.assignee_id ?? null,
    org_id: ctx.org_id,
    new_value: { task_id: result.id, title: data.title },
  });
  return repo.getTaskView(ctx, result.id);
}

export async function updateTask(ctx: TaskCtx, id: string, data: UpdateTaskInput) {
  const row = await loadVisible(ctx, id);
  if (!(await canEditTask(ctx, row))) {
    throw new ForbiddenError('You are not allowed to edit this task');
  }
  // An edit form re-sends the current assignee; only a real change is an assignment.
  if (data.assignee_id !== undefined && data.assignee_id !== row.assignee_id && data.assignee_id !== ctx.user_id) {
    assertCanAssign(ctx);
  }
  const result = await repo.updateTask(ctx, id, data);
  if (result.assignee_changed && result.assignee_id && result.assignee_id !== ctx.user_id) {
    void publishTaskEvent({
      type: 'task:assigned',
      task_id: id,
      recipient_id: result.assignee_id,
      org_id: ctx.org_id,
      tenant_id: ctx.tenant_id,
      actor_id: ctx.user_id,
    });
  }
  void logActivity({
    action_type: 'task_updated',
    performed_by: ctx.user_id,
    org_id: ctx.org_id,
    new_value: { task_id: id, status: data.status_name },
  });
  return repo.getTaskView(ctx, id);
}

export interface BulkUpdateOutcome {
  id: string;
  ok: boolean;
  error?: string;
}

// Reassign / change status for many tasks. Every id is authorised exactly like a
// single PATCH (visible to the caller AND editable by them) and runs in its own
// transaction, so one task the caller may not touch is reported and skipped
// instead of failing -- or worse, silently applying -- the rest. A missing id and
// a forbidden one read the same ("not found") so ids cannot be probed.
export async function bulkUpdateTasks(ctx: TaskCtx, input: BulkUpdateTasksInput) {
  if (input.assignee_id !== undefined && input.assignee_id !== ctx.user_id) assertCanAssign(ctx);
  const ids = [...new Set(input.ids)];
  const patch: UpdateTaskInput = {
    ...(input.assignee_id !== undefined ? { assignee_id: input.assignee_id } : {}),
    ...(input.status_name !== undefined ? { status_name: input.status_name } : {}),
    ...(input.note != null && input.status_name !== undefined ? { note: input.note } : {}),
  };

  const results: BulkUpdateOutcome[] = [];
  for (const id of ids) {
    try {
      const row = await repo.getTaskRow(ctx, id);
      if (!row || !(await canViewTask(ctx, row)) || !(await canEditTask(ctx, row))) {
        results.push({ id, ok: false, error: 'Task not found or you are not allowed to change it' });
        continue;
      }
      const result = await repo.updateTask(ctx, id, patch);
      if (result.assignee_changed && result.assignee_id && result.assignee_id !== ctx.user_id) {
        void publishTaskEvent({
          type: 'task:assigned',
          task_id: id,
          recipient_id: result.assignee_id,
          org_id: ctx.org_id,
          tenant_id: ctx.tenant_id,
          actor_id: ctx.user_id,
        });
      }
      results.push({ id, ok: true });
    } catch (err) {
      // Only our own typed errors carry a message safe to show; anything else
      // (a raw DB error) is reported generically and left to the server log.
      results.push({ id, ok: false, error: err instanceof AppError ? err.message : 'Update failed' });
    }
  }

  const updated = results.filter((r) => r.ok).map((r) => r.id);
  void logActivity({
    action_type: 'tasks_bulk_updated',
    performed_by: ctx.user_id,
    org_id: ctx.org_id,
    new_value: {
      task_ids: updated,
      assignee_id: input.assignee_id,
      status: input.status_name,
      skipped: results.length - updated.length,
    },
  });
  return { results, updated: updated.length, failed: results.length - updated.length };
}

export async function deleteTask(ctx: TaskCtx, id: string) {
  // Visibility first: a task in someone else's private list does not exist for an
  // admin, so it cannot be deleted by id either.
  const row = await loadVisible(ctx, id);
  // Creator or org admin (rank ≥ 80).
  if (row.created_by !== ctx.user_id && !canAdministerTasks(ctx)) {
    throw new ForbiddenError('Only the creator or an org admin can delete this task');
  }
  await repo.softDeleteTask(ctx, id);
  void logActivity({
    action_type: 'task_deleted',
    performed_by: ctx.user_id,
    org_id: ctx.org_id,
    new_value: { task_id: id },
  });
}

// ── Comments ──────────────────────────────────────────────────────────────────
export async function addComment(ctx: TaskCtx, taskId: string, body: string) {
  await loadVisible(ctx, taskId);
  const result = await repo.addComment(ctx, taskId, body);
  void logActivity({
    action_type: 'task_comment_created',
    performed_by: ctx.user_id,
    org_id: ctx.org_id,
    new_value: { task_id: taskId, comment_id: result.id },
  });
  return result;
}

export async function listComments(ctx: TaskCtx, taskId: string) {
  await loadVisible(ctx, taskId);
  return repo.listComments(ctx, taskId);
}

// ── Status history ───────────────────────────────────────────────────────────
export async function getStatusHistory(ctx: TaskCtx, taskId: string) {
  await loadVisible(ctx, taskId);
  return repo.listStatusHistory(ctx, taskId);
}
