'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionUser } from '@platform/types';
import { Alert, PageBody, PageHeader } from '@platform/ui-kit';
import { tasks as tasksApi, taskLists as taskListsApi } from '../../lib/api/client';
import type { TaskListView, TaskPriorityName, TaskStatusName, TaskView } from '../../lib/tasks/types';
import { useAssignableUsers } from '../../hooks/useAssignableUsers';
import TasksTabs from './TasksTabs';
import TaskListSidebar from './TaskListSidebar';
import TaskFilterChips from './TaskFilterChips';
import TaskQuickAdd from './TaskQuickAdd';
import TaskGroupedList from './TaskGroupedList';
import TaskDetailDrawer from './TaskDetailDrawer';

interface Props {
  actor: SessionUser;
}

export default function TasksShell({ actor }: Props) {
  const [lists, setLists] = useState<TaskListView[]>([]);
  const [items, setItems] = useState<TaskView[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatusName | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityName | ''>('');
  const [includeCompleted, setIncludeCompleted] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const assignableUsers = useAssignableUsers();

  const loadLists = useCallback(() => {
    taskListsApi
      .list({ scope: 'own', limit: 100 })
      .then((res) => setLists(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load lists.'));
  }, []);

  const loadTasks = useCallback(() => {
    setLoading(true);
    tasksApi
      .list({
        scope: 'own',
        list_id: activeListId ?? undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        include_completed: includeCompleted,
        limit: 100,
      })
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load tasks.'))
      .finally(() => setLoading(false));
  }, [activeListId, statusFilter, priorityFilter, includeCompleted]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleQuickAdd = async (title: string) => {
    setError(null);
    try {
      await tasksApi.create({
        title,
        list_id: activeListId,
        status_name: 'todo',
        priority_name: 'medium',
      });
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task.');
    }
  };

  const handleStatusChange = async (task: TaskView, status: string) => {
    setError(null);
    try {
      await tasksApi.update(task.id, { status_name: status as TaskStatusName });
      loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task.');
    }
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHeader
        title="My Tasks"
        subtitle={`Everything you created or are assigned, ${actor.name || actor.email}.`}
        tabs={<TasksTabs actor={actor} />}
      />

      <PageBody>
        {error && <Alert tone="error">{error}</Alert>}

        {/* The list rail only becomes a second column at lg — at sm it sat
            directly beside the platform AppSidebar at the same 224px width,
            reading as two competing nav columns. */}
        <div className="flex flex-col gap-5 lg:flex-row">
          <TaskListSidebar
            lists={lists}
            activeListId={activeListId}
            onSelect={setActiveListId}
            onListCreated={loadLists}
          />

          <div className="min-w-0 flex-1 space-y-3">
            <TaskQuickAdd onCreate={handleQuickAdd} />

            <TaskFilterChips
              status={statusFilter}
              priority={priorityFilter}
              includeCompleted={includeCompleted}
              onStatusChange={setStatusFilter}
              onPriorityChange={setPriorityFilter}
              onIncludeCompletedChange={setIncludeCompleted}
            />

            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-[#94A3B8]">Loading…</div>
            ) : (
              <TaskGroupedList tasks={items} onOpen={setSelectedTask} onStatusChange={handleStatusChange} />
            )}
          </div>
        </div>
      </PageBody>

      <TaskDetailDrawer
        task={selectedTask}
        lists={lists}
        assignableUsers={assignableUsers}
        onClose={() => setSelectedTask(null)}
        onSaved={() => { loadTasks(); setSelectedTask(null); }}
      />
    </div>
  );
}
