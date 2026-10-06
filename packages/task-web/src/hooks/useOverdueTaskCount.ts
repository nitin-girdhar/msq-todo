'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionUser } from '@platform/types';
import { canViewTasks } from '@task/authz';
import { tasks as tasksApi } from '../lib/api/client';

// Fired by screens that change tasks so the nav badge catches up without waiting
// for the next poll.
const CHANGED_EVENT = 'task:changed';

export function notifyTasksChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

const POLL_MS = 60_000;

interface UseOverdueTaskCountReturn {
  overdue: number;
}

/**
 * The actor's own overdue tasks, for the My Tasks nav badge — the same set the My
 * Tasks "SLA critical" tile counts, taken server-side under the same scope rules.
 * Renders 0 and makes no request for an actor who cannot view tasks. Refreshed on
 * a 60s poll, tab focus and screens that edit tasks. Deliberately no EventSource of
 * its own: a layout-wide badge would add a long-lived connection to every tab, and
 * browsers cap those per origin.
 */
export function useOverdueTaskCount(actor: SessionUser): UseOverdueTaskCountReturn {
  const [overdue, setOverdue] = useState(0);
  const allowed = canViewTasks(actor);

  const fetchCount = useCallback(async () => {
    if (!allowed) return;
    try {
      const res = await tasksApi.stats({ scope: 'own' });
      setOverdue(res.data.overdue);
    } catch {
      // A badge is a hint: keep the last known count rather than flashing an error.
    }
  }, [allowed]);

  useEffect(() => { void fetchCount(); }, [fetchCount]);

  useEffect(() => {
    if (!allowed) return;
    const refresh = () => { void fetchCount(); };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = window.setInterval(onVisible, POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(CHANGED_EVENT, refresh);
    };
  }, [allowed, fetchCount]);

  return { overdue: allowed ? overdue : 0 };
}
