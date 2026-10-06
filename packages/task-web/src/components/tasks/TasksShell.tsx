'use client';

import type { SessionUser } from '@platform/types';
import TaskHubShell from './TaskHubShell';

// My Tasks: everything the actor created or was assigned (scope=own).
export default function TasksShell({ actor }: { actor: SessionUser }) {
  return <TaskHubShell actor={actor} scope="own" />;
}
