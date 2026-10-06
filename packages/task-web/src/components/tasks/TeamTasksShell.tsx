'use client';

import type { SessionUser } from '@platform/types';
import TaskHubShell from './TaskHubShell';

// Team tasks: the actor's reports' work in the branch they are working in
// (scope=team, tasks.view.team). The page behind it redirects without that
// capability; tasks-service re-checks it on every call.
export default function TeamTasksShell({ actor }: { actor: SessionUser }) {
  return <TaskHubShell actor={actor} scope="team" />;
}
