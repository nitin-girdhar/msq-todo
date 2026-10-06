import { redirect } from 'next/navigation';
import { buildLoginUrl } from '@platform/ui-kit';
import { canViewTaskLists } from '@task/authz';
import { getServerSession } from '@platform/ui-kit/server';
import { TaskListsShell } from '@task/web';

export const dynamic = 'force-dynamic';

export default async function TaskListsPage() {
  const result = await getServerSession();
  if (!result) redirect(buildLoginUrl());
  // Advisory only (the nav hides the link too): tasks-service and RLS re-check
  // tasks.lists.view on every call. Without it, back to the tasks dashboard.
  if (!canViewTaskLists(result.session)) redirect('/tasks');
  return <TaskListsShell actor={result.session} />;
}
