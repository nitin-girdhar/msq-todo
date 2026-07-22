import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/auth.middleware.js';
import { requireModule } from '../../../middleware/require-module.middleware.js';
import { validate } from '../../../middleware/validate.middleware.js';
import { requireCapability } from '../../../middleware/require-capability.middleware.js';
import { CAPABILITY } from '@platform/rbac';
import { TasksController } from './tasks.controller.js';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksSchema,
  listMineTasksSchema,
  createTaskCommentSchema,
  idParamSchema,
} from './tasks.schema.js';

const ctrl = new TasksController();

// Every route behind requireModule('tasks'). Gateway maps /tasks* → /api/v1/tasks*.
export async function tasksRouter(app: FastifyInstance) {
  const gate = [authenticate, requireModule('tasks')] as const;

  // '/tasks/mine' must be registered before '/tasks/:id' so 'mine' is not captured as an id.
  app.get('/tasks/mine', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_VIEW), validate({ query: listMineTasksSchema })] }, ctrl.mine);

  app.get('/tasks', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_VIEW), validate({ query: listTasksSchema })] }, ctrl.list);
  app.post('/tasks', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_CREATE, 'You do not have permission to create tasks'), validate({ body: createTaskSchema })] }, ctrl.create);

  app.get('/tasks/:id', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_VIEW), validate({ params: idParamSchema })] }, ctrl.getById);
  app.patch('/tasks/:id', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_EDIT, 'You do not have permission to edit tasks'), validate({ params: idParamSchema, body: updateTaskSchema })] }, ctrl.update);
  app.delete('/tasks/:id', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_DELETE, 'You do not have permission to delete tasks'), validate({ params: idParamSchema })] }, ctrl.remove);

  app.get('/tasks/:id/comments', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_COMMENT), validate({ params: idParamSchema })] }, ctrl.listComments);
  app.post('/tasks/:id/comments', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_COMMENT, 'You do not have permission to comment on tasks'), validate({ params: idParamSchema, body: createTaskCommentSchema })] }, ctrl.addComment);

  app.get('/tasks/:id/status-history', { preHandler: [...gate, requireCapability(CAPABILITY.TASKS_HISTORY_VIEW), validate({ params: idParamSchema })] }, ctrl.statusHistory);
}
