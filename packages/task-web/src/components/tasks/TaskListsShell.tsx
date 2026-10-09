'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionUser } from '@platform/types';
import { Alert, Button, InfoTip, PageBody, PageHeader } from '@platform/ui-kit';
import { useTerm } from '@platform/ui-kit/branding';
import { canAdministerTasks, canViewOrgTasks, canViewTeamTasks } from '@task/authz';
import { taskLists as taskListsApi } from '../../lib/api/client';
import { visibilityLabel } from '../../lib/tasks/format';
import type { TaskListView, TaskVisibility } from '../../lib/tasks/types';
import { canDeleteTaskLists, canManageTaskLists } from '../../lib/tasks/permissions';
import TasksTabs from './TasksTabs';
import TaskListFormModal from './TaskListFormModal';

interface Props {
  actor: SessionUser;
}

// Tier styling: categorical tokens, never the tenant brand.
const TIER_STYLE: Record<TaskVisibility, { chip: string; blurb: string }> = {
  private: { chip: 'bg-cat-slate-container text-on-cat-slate-container', blurb: 'Only the owner' },
  team: { chip: 'bg-cat-purple-container text-on-cat-purple-container', blurb: 'Owner and their reports' },
  org: { chip: 'bg-cat-blue-container text-on-cat-blue-container', blurb: 'Everyone in the branch' },
};

// Lists & Scopes (Stitch "Lists & Scopes Governance"): every list the actor may
// see, who owns it, who can see it, and how much open work it holds. Visibility
// is enforced by tasks-service + RLS; this page only renders what it is given.
export default function TaskListsShell({ actor }: Props) {
  const term = useTerm();
  const branchWord = term('branch', 'Branch');
  const [lists, setLists] = useState<TaskListView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskListView | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManage = canManageTaskLists(actor);
  const canDelete = canDeleteTaskLists(actor);
  const isAdmin = canAdministerTasks(actor);
  const scope = canViewOrgTasks(actor) ? 'org' : canViewTeamTasks(actor) ? 'team' : 'own';

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await taskListsApi.list({ scope, limit: 100 });
      setLists(res.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lists.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [scope]);

  useEffect(() => { void load(); }, [load]);

  // The server lets only the owner (or an org admin) change a list; mirror that
  // so a button never appears for an action that would be refused.
  const mayChange = (l: TaskListView) => l.owner_id === actor.id || isAdmin;

  const remove = async (l: TaskListView) => {
    setBusyId(l.id);
    setError(null);
    try {
      await taskListsApi.remove(l.id);
      setConfirmId(null);
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the list.');
    } finally {
      setBusyId(null);
    }
  };

  const countOf = (v: TaskVisibility) => lists.filter((l) => l.visibility === v).length;

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHeader
        title="Lists & Scopes"
        subtitle={`${lists.length} list${lists.length === 1 ? '' : 's'} you can see`}
        info="A list decides who can see the tasks in it."
        tabs={<TasksTabs actor={actor} />}
        actions={canManage ? <Button variant="primary" onClick={() => { setEditing(undefined); setFormOpen(true); }}>+ New list</Button> : undefined}
      />

      <PageBody dense>
        {error && <Alert tone="error">{error}</Alert>}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['private', 'team', 'org'] as const).map((v) => (
            <div key={v} className="rounded-xl bg-surface-container-lowest p-3 shadow-card">
              <span className="flex items-center gap-1.5 text-label-sm uppercase tracking-wider text-outline">
                {visibilityLabel(v, branchWord)}
                <InfoTip label={`Who can see ${visibilityLabel(v, branchWord)} lists`}>{v === 'org' ? `Everyone in the ${branchWord.toLowerCase()}` : TIER_STYLE[v].blurb}</InfoTip>
              </span>
              <p className="text-headline-lg font-bold tabular-nums text-on-surface">{countOf(v)}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-outline" role="status">Loading…</div>
        ) : lists.length === 0 ? (
          <p className="rounded-xl border border-dashed border-outline-variant bg-surface-container-lowest px-4 py-8 text-center text-sm text-outline">
            No lists yet.{canManage ? ' Create one to group related tasks.' : ''}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {lists.map((l) => (
              <li key={l.id} className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="min-w-0 truncate text-headline-sm text-on-surface" title={l.name}>{l.name}</h2>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-label-sm font-medium ${TIER_STYLE[l.visibility].chip}`}>
                    {visibilityLabel(l.visibility, branchWord)}
                  </span>
                </div>
                {l.description && <p className="line-clamp-2 text-body-sm text-on-surface-variant">{l.description}</p>}
                <dl className="mt-auto grid grid-cols-2 gap-2 text-body-sm">
                  <div>
                    <dt className="text-label-sm uppercase tracking-wider text-outline">Owner</dt>
                    <dd className="truncate text-on-surface">{l.owner_name}</dd>
                  </div>
                  <div>
                    <dt className="text-label-sm uppercase tracking-wider text-outline">Open tasks</dt>
                    <dd className="tabular-nums text-on-surface">{l.open_task_count ?? 0}</dd>
                  </div>
                </dl>

                {mayChange(l) && (canManage || canDelete) && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 pt-3">
                    {canManage && (
                      <Button variant="secondary" onClick={() => { setEditing(l); setFormOpen(true); }}>Edit</Button>
                    )}
                    {canDelete && (
                      confirmId === l.id ? (
                        <span className="flex items-center gap-2 text-xs text-on-surface">
                          Delete? Its tasks are kept.
                          <Button variant="danger" onClick={() => void remove(l)} disabled={busyId === l.id}>Yes, delete</Button>
                          <Button variant="ghost" onClick={() => setConfirmId(null)} disabled={busyId === l.id}>Keep</Button>
                        </span>
                      ) : (
                        <Button variant="danger" onClick={() => setConfirmId(l.id)}>Delete</Button>
                      )
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PageBody>

      <TaskListFormModal
        open={formOpen}
        list={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load(true)}
      />
    </div>
  );
}
