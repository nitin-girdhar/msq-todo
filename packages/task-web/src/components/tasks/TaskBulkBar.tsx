'use client';

import { useState } from 'react';
import type { SessionUser } from '@platform/types';
import { Button, Modal, UserPicker } from '@platform/ui-kit';
import { tasks as tasksApi } from '../../lib/api/client';
import { TASK_STATUS_OPTIONS, taskCode } from '../../lib/tasks/format';
import type { BulkUpdateResult, TaskStatusName, TaskView } from '../../lib/tasks/types';
import { CONTROL_CLASS } from './TaskFilterBar';

// Mirrors the server cap (bulkUpdateTasksSchema: 1-100 ids).
export const BULK_MAX_TASKS = 100;

type BulkAction = 'reassign' | 'status';

interface Props {
  /** The rows ticked in the table / cards. Renders nothing while empty. */
  targets: TaskView[];
  assignableUsers: SessionUser[];
  /** tasks.assign — reassigning to someone else needs it (the server re-checks). */
  canAssign: boolean;
  onClear: () => void;
  /** After a run that changed at least one task — refetch the list. */
  onApplied: () => void;
}

/**
 * The strip that appears above the list once rows are ticked (Stitch "selection
 * bar"). The caller only renders it for holders of tasks.bulk; the server
 * re-checks that and each task individually, so a task the user may not change is
 * reported back and skipped rather than failing the batch.
 */
export default function TaskBulkBar({ targets, assignableUsers, canAssign, onClear, onApplied }: Props) {
  const [action, setAction] = useState<BulkAction | null>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [status, setStatus] = useState<TaskStatusName>('in_progress');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUpdateResult | null>(null);

  if (targets.length === 0 && !result) return null;
  const tooMany = targets.length > BULK_MAX_TASKS;
  const titleOf = (id: string) => {
    const t = targets.find((x) => x.id === id);
    return t ? `${taskCode(t.task_no)} ${t.title}` : id;
  };

  const close = () => {
    if (busy) return;
    const changed = (result?.updated ?? 0) > 0;
    setAction(null);
    setResult(null);
    setError(null);
    setNote('');
    if (changed) { onClear(); onApplied(); }
  };

  const run = async () => {
    if (!action || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await tasksApi.bulkUpdate({
        ids: targets.map((t) => t.id),
        ...(action === 'reassign' ? { assignee_id: assigneeId || null } : { status_name: status }),
        ...(action === 'status' && note.trim() ? { note: note.trim() } : {}),
      });
      setResult(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The bulk update failed.');
    } finally {
      setBusy(false);
    }
  };

  const failures = result?.results.filter((r) => !r.ok) ?? [];

  return (
    <>
      {targets.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-container px-3 py-2 text-on-primary-container shadow-card"
        >
          <span className="text-label-md font-semibold tabular-nums">{targets.length} selected</span>
          {tooMany && <span className="text-body-sm">Select at most {BULK_MAX_TASKS} at a time.</span>}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {canAssign && (
              <button
                type="button"
                disabled={tooMany}
                onClick={() => setAction('reassign')}
                className="min-h-9 rounded-lg bg-surface-container-lowest px-3 text-label-md font-semibold text-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Bulk reassign
              </button>
            )}
            <button
              type="button"
              disabled={tooMany}
              onClick={() => setAction('status')}
              className="min-h-9 rounded-lg bg-surface-container-lowest px-3 text-label-md font-semibold text-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Change status
            </button>
            <button type="button" onClick={onClear} className="min-h-9 rounded-lg px-3 text-label-md font-semibold underline-offset-2 hover:underline">
              Clear
            </button>
          </div>
        </div>
      )}

      {action && (
        <Modal
          open
          onClose={close}
          title={action === 'reassign' ? `Reassign ${targets.length} task${targets.length === 1 ? '' : 's'}` : `Change status of ${targets.length} task${targets.length === 1 ? '' : 's'}`}
          locked={busy}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="md" onClick={close} disabled={busy}>{result ? 'Close' : 'Cancel'}</Button>
              {!result && (
                <Button variant="primary" size="md" onClick={() => void run()} disabled={busy}>
                  {busy ? 'Applying…' : 'Apply'}
                </Button>
              )}
            </div>
          }
        >
          {result ? (
            <div className="space-y-3" role="status">
              <p className="text-body-md text-on-surface">
                {result.updated} updated{result.failed > 0 ? `, ${result.failed} skipped` : ''}.
              </p>
              {failures.length > 0 && (
                <ul className="space-y-1 rounded-lg bg-status-overdue-container/40 p-3 text-body-sm text-on-status-overdue-container">
                  {failures.map((f) => (
                    <li key={f.id}><span className="font-semibold">{titleOf(f.id)}</span>: {f.error ?? 'Not updated'}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {action === 'reassign' ? (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-on-surface-variant">New assignee</label>
                  <UserPicker value={assigneeId} onChange={setAssigneeId} users={assignableUsers} allowEmpty emptyLabel="Unassigned" />
                </div>
              ) : (
                <>
                  <div>
                    <label htmlFor="bulk-status" className="mb-1 block text-xs font-semibold text-on-surface-variant">New status</label>
                    <select id="bulk-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatusName)} className={`${CONTROL_CLASS} w-full`}>
                      {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bulk-note" className="mb-1 block text-xs font-semibold text-on-surface-variant">Note (optional, saved in each task&apos;s history)</label>
                    <input id="bulk-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className={`${CONTROL_CLASS} w-full`} />
                  </div>
                </>
              )}
              <p className="text-body-sm text-on-surface-variant">
                Each task is checked on its own. One you are not allowed to change is skipped and listed here afterwards.
              </p>
              {error && <p className="text-xs text-error">{error}</p>}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
