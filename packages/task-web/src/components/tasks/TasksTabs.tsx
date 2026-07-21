'use client';

import { PageTabs, type PageTab } from '@platform/ui-kit';
import type { SessionUser } from '@platform/types';
import { canViewTeamTasks } from '@task/authz';

interface Props {
  actor: SessionUser;
}

// In-page sub-navigation for the Tasks module — mirrors LeaveTabs.
export default function TasksTabs({ actor }: Props) {
  const tabs: PageTab[] = [{ href: '/tasks', label: 'My Tasks', exact: true }];
  if (canViewTeamTasks(actor.rank)) {
    tabs.push({ href: '/tasks/team', label: 'Team' });
  }

  return <PageTabs tabs={tabs} label="Tasks sections" />;
}
