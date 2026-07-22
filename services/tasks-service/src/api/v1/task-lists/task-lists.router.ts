import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth.middleware.js';
import { requireModule } from '../../../middleware/require-module.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { requireCapability } from '../../../middleware/require-capability.middleware.js';
import { CAPABILITY } from '@platform/rbac';
import { TaskListsController } from './task-lists.controller.js';
import { createTaskListSchema, updateTaskListSchema, listTaskListsSchema, idParamSchema } from './task-lists.schema.js';

const ctrl = new TaskListsController();

// Every route behind requireModule('tasks'). Gateway maps /task-lists* →
// /api/v1/task-lists*.
export async function taskListsRouter(app: FastifyInstance) {
  const gate = [authenticate, requireModule('tasks')] as const;

  app.get('/task-lists', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_LISTS_VIEW), validate({ query: listTaskListsSchema })] }, ctrl.list);
  app.post('/task-lists', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_LISTS_MANAGE, 'You do not have permission to create task lists'), validate({ body: createTaskListSchema })] }, ctrl.create);
  app.get('/task-lists/:id', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_LISTS_VIEW), validate({ params: idParamSchema })] }, ctrl.getById);
  app.patch('/task-lists/:id', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_LISTS_MANAGE, 'You do not have permission to edit task lists'), validate({ params: idParamSchema, body: updateTaskListSchema })] }, ctrl.update);
  app.delete('/task-lists/:id', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_LISTS_DELETE, 'You do not have permission to delete task lists'), validate({ params: idParamSchema })] }, ctrl.remove);
}
