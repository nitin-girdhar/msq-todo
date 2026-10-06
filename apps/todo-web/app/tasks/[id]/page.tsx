import { notFound, redirect } from 'next/navigation';
import { buildLoginUrl } from '@platform/ui-kit';
import { canViewTasks } from '@task/authz';
import { getServerSession } from '@platform/ui-kit/server';
import { TaskDetailShell } from '@task/web';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // A malformed id is a 404 here rather than a 422 from the API.
  if (!UUID.test(id)) notFound();
  const result = await getServerSession();
  if (!result) redirect(buildLoginUrl());
  if (!canViewTasks(result.session)) redirect('/tasks');
  // Whether THIS task may be read is decided by tasks-service; the shell shows
  // "not found" for one the actor cannot see.
  return <TaskDetailShell actor={result.session} taskId={id} />;
}
