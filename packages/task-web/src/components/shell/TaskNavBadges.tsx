'use client';

import { useMemo, type ReactNode } from 'react';
import type { SessionUser } from '@platform/types';
import { NavBadgesProvider } from '@platform/ui-kit/shell';
import { useOverdueTaskCount } from '../../hooks/useOverdueTaskCount';

/**
 * Chrome, not a page: wraps AppShell in apps/todo-web's module shell so the My
 * Tasks nav item (desktop rail, collapsed rail, mobile drawer, mobile tab bar)
 * shows the actor's overdue task count. Overdue only — no other badges.
 */
export default function TaskNavBadges({ actor, children }: { actor: SessionUser; children: ReactNode }) {
  const { overdue } = useOverdueTaskCount(actor);
  const value = useMemo(() => ({ tasks: overdue }), [overdue]);
  return <NavBadgesProvider value={value}>{children}</NavBadgesProvider>;
}
