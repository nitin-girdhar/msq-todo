'use client';

import { PageTabs, type PageTab } from '@platform/ui-kit';
import type { SessionUser } from '@platform/types';
import { canViewTeamTasks, canViewTaskLists } from '@task/authz';

interface Props {
  actor: SessionUser;
}

// In-page sub-navigation for the Tasks module — mirrors LeaveTabs. The tabs are
// advisory: each page behind them re-checks its own capability server-side.
export default function TasksTabs({ actor }: Props) {
  const tabs: PageTab[] = [{ href: '/tasks', label: 'My Tasks', exact: true }];
  if (canViewTeamTasks(actor)) {
    tabs.push({ href: '/tasks/team', label: 'Team' });
  }
  if (canViewTaskLists(actor)) {
    tabs.push({ href: '/tasks/lists', label: 'Lists & Scopes' });
  }

  return <PageTabs tabs={tabs} label="Tasks sections" />;
}
