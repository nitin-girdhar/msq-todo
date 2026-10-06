import { z } from 'zod';

const TASK_STATUS_NAMES = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
const TASK_PRIORITY_NAMES = ['low', 'medium', 'high', 'urgent'] as const;
const TASK_VISIBILITY = ['private', 'team', 'org'] as const;

// Query booleans arrive as the strings 'true'/'false'; coerce deterministically
// (z.coerce.boolean treats the string 'false' as true, so it can't be used here).
const queryBool = (def: boolean) =>
  z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .default(def);

// ── Task lists ────────────────────────────────────────────────────────────────
export const createTaskListSchema = z.object({
  name:        z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().nullable().optional(),
  visibility:  z.enum(TASK_VISIBILITY).default('private'),
});

export const updateTaskListSchema = z.object({
  name:        z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  visibility:  z.enum(TASK_VISIBILITY).optional(),
  is_active:   z.boolean().optional(),
});

export const listTaskListsSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  scope: z.enum(['own', 'team', 'org']).default('own'),
});

// ── Tasks ─────────────────────────────────────────────────────────────────────
const relatedEntityRefinement = <T extends { related_entity_type?: unknown; related_entity_id?: unknown }>(
  data: T,
) => (data.related_entity_type == null) === (data.related_entity_id == null);

export const createTaskSchema = z
  .object({
    title:               z.string().min(1).max(500).trim(),
    description:         z.string().max(10000).trim().nullable().optional(),
    list_id:             z.string().uuid().nullable().optional(),
    assignee_id:         z.string().uuid().nullable().optional(),
    due_at:              z.string().datetime({ offset: true }).nullable().optional(),
    priority_name:       z.enum(TASK_PRIORITY_NAMES).default('medium'),
    status_name:         z.enum(TASK_STATUS_NAMES).default('todo'),
    parent_task_id:      z.string().uuid().nullable().optional(),
    related_entity_type: z.string().min(1).max(100).nullable().optional(),
    related_entity_id:   z.string().uuid().nullable().optional(),
    tags:                z.array(z.string().min(1).max(100)).max(50).optional(),
    recurrence_rule:     z.string().max(1000).nullable().optional(),
  })
  .refine(relatedEntityRefinement, {
    message: 'related_entity_type and related_entity_id must be provided together',
    path: ['related_entity_id'],
  });

export const updateTaskSchema = z
  .object({
    title:               z.string().min(1).max(500).trim().optional(),
    description:         z.string().max(10000).trim().nullable().optional(),
    list_id:             z.string().uuid().nullable().optional(),
    assignee_id:         z.string().uuid().nullable().optional(),
    due_at:              z.string().datetime({ offset: true }).nullable().optional(),
    priority_name:       z.enum(TASK_PRIORITY_NAMES).optional(),
    status_name:         z.enum(TASK_STATUS_NAMES).optional(),
    parent_task_id:      z.string().uuid().nullable().optional(),
    related_entity_type: z.string().min(1).max(100).nullable().optional(),
    related_entity_id:   z.string().uuid().nullable().optional(),
    tags:                z.array(z.string().min(1).max(100)).max(50).optional(),
    recurrence_rule:     z.string().max(1000).nullable().optional(),
    // Optional note recorded on a status transition (task.task_status_log).
    note:                z.string().max(2000).trim().nullable().optional(),
    // Optimistic concurrency token: the updated_at the client last read. When
    // present the UPDATE is guarded on it and a mismatch is a 409, so two people
    // editing the same task no longer silently overwrite each other. Optional so
    // server-to-server callers that legitimately want last-writer-wins are
    // unaffected; the UI always sends it.
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    (data) =>
      (data.related_entity_type === undefined && data.related_entity_id === undefined) ||
      (data.related_entity_type == null) === (data.related_entity_id == null),
    {
      message: 'related_entity_type and related_entity_id must be provided together',
      path: ['related_entity_id'],
    },
  );

// Whitelisted sort keys: the repository maps each to a fixed column expression,
// so a client value never reaches the SQL text.
const TASK_SORT_KEYS = ['created_at', 'due_at', 'priority', 'status', 'task_no', 'title'] as const;
const TASK_SLA_STATES = ['overdue', 'due_soon', 'ok'] as const;

// The filters shared by the list, stats-free export and bulk-select paths.
const taskFilterShape = {
  scope:               z.enum(['own', 'team', 'org']).default('own'),
  assignee_id:         z.string().uuid().optional(),
  // `true` = only tasks nobody owns (the Team "unassigned" tile); wins over assignee_id.
  unassigned:          queryBool(false),
  status:              z.enum(TASK_STATUS_NAMES).optional(),
  priority:            z.enum(TASK_PRIORITY_NAMES).optional(),
  sla_state:           z.enum(TASK_SLA_STATES).optional(),
  list_id:             z.string().uuid().optional(),
  due_before:          z.string().datetime({ offset: true }).optional(),
  due_after:           z.string().datetime({ offset: true }).optional(),
  related_entity_type: z.string().min(1).max(100).optional(),
  related_entity_id:   z.string().uuid().optional(),
  q:                   z.string().max(200).trim().optional(),
  include_completed:   queryBool(false),
  sort:                z.enum(TASK_SORT_KEYS).default('created_at'),
  dir:                 z.enum(['asc', 'desc']).default('desc'),
};

export const listTasksSchema = z.object({
  page:                z.coerce.number().int().positive().default(1),
  limit:               z.coerce.number().int().min(1).max(100).default(20),
  ...taskFilterShape,
});

// CSV export: same filters, one bounded page (no paging for the caller).
export const exportTasksSchema = z.object({ ...taskFilterShape });

// KPI tiles. Scope only (+ an optional list): the tiles describe the whole board,
// not the currently filtered grid, so they stay put while the user filters.
export const taskStatsSchema = z.object({
  scope:   z.enum(['own', 'team', 'org']).default('own'),
  list_id: z.string().uuid().optional(),
});

// Bulk reassign / change status. Each id is authorised on its own server-side.
export const bulkUpdateTasksSchema = z
  .object({
    ids:         z.array(z.string().uuid()).min(1).max(100),
    assignee_id: z.string().uuid().nullable().optional(),
    status_name: z.enum(TASK_STATUS_NAMES).optional(),
    note:        z.string().max(2000).trim().nullable().optional(),
  })
  .refine((d) => d.assignee_id !== undefined || d.status_name !== undefined, {
    message: 'Provide assignee_id and/or status_name',
    path: ['assignee_id'],
  });

export const listMineTasksSchema = z.object({
  page:  z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ── Comments ──────────────────────────────────────────────────────────────────
export const createTaskCommentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

// Shared :id route-param guard (a malformed UUID should 422, not 500 on the cast).
export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export type CreateTaskListInput = z.infer<typeof createTaskListSchema>;
export type UpdateTaskListInput = z.infer<typeof updateTaskListSchema>;
export type ListTaskListsInput = z.infer<typeof listTaskListsSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksInput = z.infer<typeof listTasksSchema>;
export type ExportTasksInput = z.infer<typeof exportTasksSchema>;
export type TaskStatsInput = z.infer<typeof taskStatsSchema>;
export type BulkUpdateTasksInput = z.infer<typeof bulkUpdateTasksSchema>;
export type ListMineTasksInput = z.infer<typeof listMineTasksSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;
