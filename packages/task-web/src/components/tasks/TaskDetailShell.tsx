'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@platform/types';
import { canViewOrgTasks, canViewTeamTasks } from '@task/authz';
import { Alert, PageBody, PageHeader } from '@platform/ui-kit';
import { tasks as tasksApi, taskLists as taskListsApi } from '../../lib/api/client';
import type { TaskListView, TaskView } from '../../lib/tasks/types';
import { taskCode } from '../../lib/tasks/format';
import { useAssignableUsers } from '../../hooks/useAssignableUsers';
import { canAssignTasks, canDeleteTasks } from '../../lib/tasks/permissions';
import TasksTabs from './TasksTabs';
import TaskDetailPanel from './TaskDetailPanel';
import TaskStatusChip from './TaskStatusChip';

interface Props {
  actor: SessionUser;
  taskId: string;
}

// Full-page task view (Stitch "Task Detail & Assignment"). The server decides
// whether the actor may see the task at all: a task they cannot read answers 404,
// which is shown as "not found" so ids cannot be probed.
export default function TaskDetailShell({ actor, taskId }: Props) {
  const router = useRouter();
  const [task, setTask] = useState<TaskView | null>(null);
  const [siblings, setSiblings] = useState<TaskView[]>([]);
  const [lists, setLists] = useState<TaskListView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const assignableUsers = useAssignableUsers();

  // The widest scope the actor holds, so the rail lists what they can actually see.
  const scope = canViewOrgTasks(actor) ? 'org' : canViewTeamTasks(actor) ? 'team' : 'own';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await tasksApi.get(taskId);
      setTask(res.data);
    } catch (err) {
      setTask(null);
      const status = (err as { status?: number }).status;
      setError(status === 404 ? 'This task was not found, or you do not have access to it.' : err instanceof Error ? err.message : 'Failed to load the task.');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    taskListsApi
      .list({ scope: scope === 'own' ? 'own' : 'team', limit: 100 })
      .then((res) => setLists(res.data))
      .catch(() => setLists([]));
  }, [scope]);

  const listId = task?.list_id ?? null;
  useEffect(() => {
    if (!listId) { setSiblings([]); return; }
    tasksApi
      .list({ scope, list_id: listId, include_completed: true, limit: 14, sort: 'task_no', dir: 'desc' })
      .then((res) => setSiblings(res.data))
      .catch(() => setSiblings([]));
  }, [listId, scope, task?.updated_at]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHeader
        title={task ? task.title : 'Task'}
        {...(task ? { subtitle: `${taskCode(task.task_no)}${task.org_name ? ` · ${task.org_name}` : ''}` } : {})}
        tabs={<TasksTabs actor={actor} />}
      />

      <PageBody dense>
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-on-surface-variant">
          <Link href="/tasks" className="font-semibold text-primary hover:underline">My Tasks</Link>
          <span aria-hidden>/</span>
          {task?.list_name && (<><span>{task.list_name}</span><span aria-hidden>/</span></>)}
          <span className="font-mono text-on-surface">{task ? taskCode(task.task_no) : '…'}</span>
        </nav>

        {error && <Alert tone="error">{error}</Alert>}
        {saved && <Alert tone="success">Changes saved.</Alert>}

        {loading && <div className="py-12 text-center text-sm text-outline" role="status">Loading…</div>}

        {task && (
          <div className="flex flex-col gap-5 lg:flex-row">
            {siblings.length > 1 && (
              <aside aria-label={`Tasks in ${task.list_name ?? 'this list'}`} className="w-full shrink-0 space-y-2 lg:w-64">
                <h2 className="text-label-sm font-semibold uppercase tracking-wider text-outline">
                  In {task.list_name} ({siblings.length}{siblings.length === 14 ? '+' : ''})
                </h2>
                <ul className="space-y-1.5">
                  {siblings.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/tasks/${s.id}`}
                        aria-current={s.id === task.id ? 'page' : undefined}
                        className={`block rounded-lg px-3 py-2 text-xs ${
                          s.id === task.id ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-surface-container-lowest text-on-surface shadow-card hover:shadow-overlay'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-mono text-label-sm text-on-surface-variant">{taskCode(s.task_no)}</span>
                          <TaskStatusChip status={s.status_name} label={s.status_label} />
                        </span>
                        <span className="mt-1 block truncate font-medium">{s.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </aside>
            )}

            <section className="min-w-0 flex-1 rounded-xl bg-surface-container-lowest p-4 shadow-card sm:p-6">
              <TaskDetailPanel
                task={task}
                lists={lists}
                assignableUsers={assignableUsers}
                actor={actor}
                canAssign={canAssignTasks(actor)}
                canDelete={canDeleteTasks(actor)}
                onSaved={(updated) => { setTask(updated); setSaved(true); window.setTimeout(() => setSaved(false), 2500); }}
                onDeleted={() => router.push('/tasks')}
                onReload={() => void load()}
              />
            </section>
          </div>
        )}
      </PageBody>
    </div>
  );
}
