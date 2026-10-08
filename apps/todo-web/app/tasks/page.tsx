import { notFound, redirect } from 'next/navigation';
import { buildLoginUrl } from '@platform/ui-kit';
import { getServerSession } from '@platform/ui-kit/server';
import { canViewTaskLists, canViewTasks } from '@task/authz';
import { TasksShell } from '@task/web';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const result = await getServerSession();
  if (!result) redirect(buildLoginUrl());
  // tasks.view is what every read behind this page requires; without it the page would
  // render and 403 on each call. Another section they hold, or a 404.
  if (!canViewTasks(result.session)) {
    if (canViewTaskLists(result.session)) redirect('/tasks/lists');
    notFound();
  }
  return <TasksShell actor={result.session} />;
}
