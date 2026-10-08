'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SessionUser } from '@platform/types';
import { Button, SpeechInputButton, UserPicker, appendDictation } from '@platform/ui-kit';
import { tasks as tasksApi } from '../../lib/api/client';
import { canCommentOnTasks, canViewTaskHistory } from '../../lib/tasks/permissions';
import {
  TASK_PRIORITY_OPTIONS,
  TASK_STATUS_OPTIONS,
  dueDateToISO,
  formatDateTime,
  isoToDateInput,
  taskCode,
} from '../../lib/tasks/format';
import type { TaskCommentView, TaskListView, TaskStatusHistoryView, TaskView } from '../../lib/tasks/types';
import { CONTROL_CLASS } from './TaskFilterBar';
import TaskSlaChip from './TaskSlaChip';
import TaskStatusChip from './TaskStatusChip';

const TITLE_MAX = 500;

interface Props {
  task: TaskView;
  lists: TaskListView[];
  assignableUsers: SessionUser[];
  actor: SessionUser;
  /** tasks.assign — hides the picker (and shows the assignee read-only) without it. */
  canAssign: boolean;
  /** tasks.delete — the server still decides whose tasks. */
  canDelete: boolean;
  /** Called with the server's fresh copy after a successful save. */
  onSaved: (task: TaskView) => void;
  onDeleted: () => void;
  /** Re-read the task (after a stale-edit conflict). */
  onReload: () => void;
  /** Hide the heading when the host (the page) renders its own. */
  hideHeader?: boolean;
}

type Tab = 'comments' | 'history';

const FIELD_LABEL = 'mb-1 block text-xs font-semibold text-on-surface-variant';

export default function TaskDetailPanel({
  task, lists, assignableUsers, actor, canAssign, canDelete, onSaved, onDeleted, onReload, hideHeader,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<TaskView['priority_name']>('medium');
  const [status, setStatus] = useState<TaskView['status_name']>('todo');
  const [listId, setListId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Notes are tasks.comment, the audit trail is tasks.history.view: each tab exists only for its holder.
  const mayComment = canCommentOnTasks(actor);
  const mayViewHistory = canViewTaskHistory(actor);
  const [tab, setTab] = useState<Tab>(mayComment ? 'comments' : 'history');
  const [comments, setComments] = useState<TaskCommentView[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [history, setHistory] = useState<TaskStatusHistoryView[]>([]);

  // (Re)load the form whenever a different task — or a newer version of this one —
  // arrives, so "Discard" and a post-conflict reload both land on server truth.
  const resetForm = useCallback(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setAssigneeId(task.assignee_id ?? '');
    setDue(isoToDateInput(task.due_at));
    setPriority(task.priority_name ?? 'medium');
    setStatus(task.status_name);
    setListId(task.list_id ?? '');
    setTags(task.tags);
    setTagDraft('');
    setError(null);
    setStale(false);
    setConfirmDelete(false);
  }, [task]);

  useEffect(() => { resetForm(); }, [resetForm]);

  useEffect(() => {
    setComments([]);
    setHistory([]);
    setCommentBody('');
    setCommentError(null);
    void tasksApi.comments.list(task.id).then((res) => setComments(res.data)).catch(() => setComments([]));
    void tasksApi.statusHistory.list(task.id).then((res) => setHistory(res.data)).catch(() => setHistory([]));
  }, [task.id]);

  const addTag = () => {
    const t = tagDraft.trim().replace(/,$/, '').trim();
    if (t && !tags.includes(t) && tags.length < 50) setTags((p) => [...p, t.slice(0, 100)]);
    setTagDraft('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setStale(false);
    try {
      const res = await tasksApi.update(task.id, {
        title: title.trim(),
        description: description.trim() || null,
        assignee_id: assigneeId || null,
        due_at: dueDateToISO(due),
        priority_name: priority ?? undefined,
        status_name: status,
        list_id: listId || null,
        tags,
        // The version this panel was opened against: a mismatch comes back as 409
        // and is shown below, instead of quietly overwriting someone else's edit.
        expected_updated_at: new Date(task.updated_at).toISOString(),
      });
      onSaved(res.data);
    } catch (err) {
      const status409 = (err as { status?: number }).status === 409;
      setStale(status409);
      setError(err instanceof Error ? err.message : 'Failed to save the task.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    setError(null);
    try {
      await tasksApi.remove(task.id);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the task.');
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    const body = commentBody.trim();
    if (!body || commentBusy) return;
    setCommentBusy(true);
    setCommentError(null);
    try {
      await tasksApi.comments.add(task.id, body);
      setCommentBody('');
      const res = await tasksApi.comments.list(task.id);
      setComments(res.data);
    } catch (err) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post the comment.');
    } finally {
      setCommentBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      // Absolute link to the full page; Next's basePath is part of the page URL.
      const base = `${window.location.origin}${window.location.pathname.replace(/\/tasks(\/.*)?$/, '/tasks')}`;
      await navigator.clipboard.writeText(`${base}/${task.id}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the link — copy it from the address bar instead.');
    }
  };

  const assigneeName = assignableUsers.find((u) => u.id === assigneeId)?.name ?? task.assignee_name ?? 'Unassigned';
  const dirty =
    title !== task.title ||
    description !== (task.description ?? '') ||
    assigneeId !== (task.assignee_id ?? '') ||
    due !== isoToDateInput(task.due_at) ||
    priority !== (task.priority_name ?? 'medium') ||
    status !== task.status_name ||
    listId !== (task.list_id ?? '') ||
    tags.join('\u0001') !== task.tags.join('\u0001');

  return (
    <div className="space-y-5">
      {!hideHeader && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-label-md text-on-surface-variant">{taskCode(task.task_no)}</span>
          <TaskStatusChip status={task.status_name} label={task.status_label} />
          <TaskSlaChip state={task.sla_state} />
          <button
            type="button"
            onClick={() => void copyLink()}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-label-md font-semibold text-primary hover:bg-primary-fixed/50"
          >
            {copied ? 'Link copied' : 'Copy link'}
          </button>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="task-title" className={FIELD_LABEL}>Title</label>
          <span className="text-label-sm tabular-nums text-outline" aria-live="polite">{title.length} / {TITLE_MAX}</span>
        </div>
        <input
          id="task-title"
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          className={`${CONTROL_CLASS} h-auto w-full py-2 text-sm`}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor="task-desc" className="block text-xs font-semibold text-on-surface-variant">Description</label>
          <SpeechInputButton onText={(t) => setDescription((p) => appendDictation(p, t))} disabled={saving} />
        </div>
        <textarea
          id="task-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={FIELD_LABEL}>Assignee</label>
          {canAssign ? (
            <UserPicker value={assigneeId} onChange={setAssigneeId} users={assignableUsers} allowEmpty emptyLabel="Unassigned" />
          ) : (
            <div className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
              {assigneeName}
            </div>
          )}
          {assigneeId !== actor.id && (
            <button
              type="button"
              onClick={() => setAssigneeId(actor.id)}
              className="mt-1 text-label-md font-semibold text-primary hover:underline"
            >
              Assign to me
            </button>
          )}
        </div>
        <div>
          <label htmlFor="task-due" className={FIELD_LABEL}>Due date</label>
          <input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${CONTROL_CLASS} w-full`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="task-priority" className={FIELD_LABEL}>Priority</label>
          <select id="task-priority" value={priority ?? 'medium'} onChange={(e) => setPriority(e.target.value as TaskView['priority_name'])} className={`${CONTROL_CLASS} w-full`}>
            {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="task-status" className={FIELD_LABEL}>Status</label>
          <select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskView['status_name'])} className={`${CONTROL_CLASS} w-full`}>
            {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="task-list" className={FIELD_LABEL}>List</label>
          <select id="task-list" value={listId} onChange={(e) => setListId(e.target.value)} className={`${CONTROL_CLASS} w-full`}>
            <option value="">No list</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="task-tags" className={FIELD_LABEL}>Tags</label>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-label-sm text-on-primary-fixed-variant">
              {t}
              <button type="button" aria-label={`Remove tag ${t}`} onClick={() => setTags((p) => p.filter((x) => x !== t))} className="text-on-primary-fixed-variant/70 hover:text-on-primary-fixed-variant">×</button>
            </span>
          ))}
          <input
            id="task-tags"
            type="text"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
              if (e.key === 'Backspace' && !tagDraft && tags.length > 0) setTags((p) => p.slice(0, -1));
            }}
            onBlur={addTag}
            placeholder={tags.length === 0 ? 'Add a tag and press Enter' : 'Add tag'}
            className="min-w-[7rem] flex-1 border-none bg-transparent text-xs text-on-surface placeholder:text-outline focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-error/30 bg-error-container px-3 py-2 text-xs text-on-error-container">
          {error}
          {stale && (
            <button type="button" onClick={onReload} className="ml-2 font-semibold underline">Reload the latest version</button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canDelete ? (
          confirmDelete ? (
            <span className="flex items-center gap-2 text-xs text-on-surface">
              Archive this task?
              <Button variant="danger" onClick={() => void remove()} disabled={saving}>Yes, archive</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={saving}>Keep</Button>
            </span>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)} disabled={saving}>Archive / delete</Button>
          )
        ) : <span />}
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={resetForm} disabled={saving || !dirty}>Discard changes</Button>
          <Button variant="primary" size="md" onClick={() => void save()} disabled={saving || !dirty || !title.trim()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {(mayComment || mayViewHistory) && <section aria-label="Notes and audit history">
        <div role="tablist" className="flex gap-4 border-b border-outline-variant">
          {([...(mayComment ? [['comments', `Notes & comments (${comments.length})`]] : []), ...(mayViewHistory ? [['history', `Audit history (${history.length})`]] : [])] as Array<[Tab, string]>).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-1 pb-2 text-label-md font-semibold ${
                tab === id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'comments' ? (
          <div className="mt-3 space-y-3">
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-surface-container-low px-3 py-2 text-xs">
                  <span className="font-medium text-on-surface">{c.user_name}</span>
                  <span className="ml-2 text-outline">{formatDateTime(c.created_at)}</span>
                  <p className="mt-0.5 whitespace-pre-wrap text-on-surface-variant">{c.body}</p>
                </li>
              ))}
              {comments.length === 0 && <p className="text-xs text-outline">No comments yet.</p>}
            </ul>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void addComment(); }}
                aria-label="Add a comment"
                placeholder="Add a comment…"
                maxLength={5000}
                className={`${CONTROL_CLASS} h-auto w-full py-2 text-sm`}
              />
              <SpeechInputButton onText={(t) => setCommentBody((p) => appendDictation(p, t, 5000))} disabled={commentBusy} compact />
              <Button variant="secondary" onClick={() => void addComment()} disabled={commentBusy || !commentBody.trim()}>
                Post
              </Button>
            </div>
            {commentError && <p className="text-xs text-error">{commentError}</p>}
          </div>
        ) : (
          <div className="mt-3">
            {history.length === 0 ? (
              <p className="text-xs text-outline">No status changes yet.</p>
            ) : (
              <ol className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-on-surface-variant">
                    <span className="font-medium text-on-surface">{h.changed_by_name ?? 'System'}</span>{' '}
                    {h.old_status_label ? (
                      <>moved from <TaskStatusChip status={h.old_status_name!} label={h.old_status_label} /> to</>
                    ) : (
                      'set'
                    )}{' '}
                    <TaskStatusChip status={h.new_status_name} label={h.new_status_label} />
                    <span className="ml-2 text-outline">{formatDateTime(h.changed_at)}</span>
                    {h.note && <p className="mt-0.5 text-on-surface-variant">{h.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </section>}
    </div>
  );
}
