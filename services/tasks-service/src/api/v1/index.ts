import type { FastifyInstance } from 'fastify';
import { taskListsRouter } from './task-lists/task-lists.router.js';
import { tasksRouter } from './tasks/tasks.router.js';
// Tenant-scoped lookup admin (N-6): super_admin manages Task reference data
// within a selected tenant. Moved here from admin-service so the write executes
// in the schema-owning service under tenant RLS (never root_service). task-roles
// was a sibling here; removed along with task.roles/task.member_roles —
// role/rank resolution runs on the unified iam ladder now, see @platform/db's
// resolveGlobalRole.
import { taskStatusesRouter } from './task-statuses/task-statuses.router.js';
import { taskPrioritiesRouter } from './task-priorities/task-priorities.router.js';

export async function v1Router(app: FastifyInstance) {
  await app.register(taskListsRouter);
  await app.register(tasksRouter);
  await app.register(taskStatusesRouter);
  await app.register(taskPrioritiesRouter);
}
