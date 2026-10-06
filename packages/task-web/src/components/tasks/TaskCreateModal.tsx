'use client';

import { useState } from 'react';
import type { SessionUser } from '@platform/types';
import { Button, Modal, SpeechInputButton, UserPicker, appendDictation } from '@platform/ui-kit';
import { tasks as tasksApi } from '../../lib/api/client';
import { TASK_PRIORITY_OPTIONS, dueDateToISO } from '../../lib/tasks/format';
import type { TaskListView, TaskPriorityName } from '../../lib/tasks/types';
import { CONTROL_CLASS } from './TaskFilterBar';

interface Props {
  open: boolean;
  lists: TaskListView[];
  assignableUsers: SessionUser[];
  /** tasks.assign — without it the assignee stays unset (the server re-checks). */
  canAssign: boolean;
  /** Pre-selects the list, e.g. the one the user is filtering by. */
  defaultListId?: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function TaskCreateModal({ open, lists, assignableUsers, canAssign, defaultListId = '', onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState(defaultListId);
  const [priority, setPriority] = useState<TaskPriorityName>('medium');
  const [due, setDue] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setListId(defaultListId);
    setPriority('medium');
    setDue('');
    setAssigneeId('');
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await tasksApi.create({
        title: title.trim(),
        description: description.trim() || null,
        list_id: listId || null,
        priority_name: priority,
        due_at: dueDateToISO(due),
        status_name: 'todo',
        ...(canAssign && assigneeId ? { assignee_id: assigneeId } : {}),
      });
      reset();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="New task"
      maxWidth="max-w-xl"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="md" onClick={() => void submit()} disabled={saving || !title.trim()}>
            {saving ? 'Creating…' : 'Create task'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="new-task-title" className="block text-xs font-semibold text-on-surface-variant">Title</label>
            <SpeechInputButton onText={(t) => setTitle((p) => appendDictation(p, t, 500))} disabled={saving} />
          </div>
          <input
            id="new-task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={500}
            placeholder="e.g. Review Q3 onboarding handbook"
            className={`${CONTROL_CLASS} h-auto w-full py-2 text-sm`}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="new-task-desc" className="block text-xs font-semibold text-on-surface-variant">Description (optional)</label>
            <SpeechInputButton onText={(t) => setDescription((p) => appendDictation(p, t))} disabled={saving} />
          </div>
          <textarea
            id="new-task-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="new-task-list" className="mb-1 block text-xs font-semibold text-on-surface-variant">List</label>
            <select id="new-task-list" value={listId} onChange={(e) => setListId(e.target.value)} className={`${CONTROL_CLASS} w-full`}>
              <option value="">No list</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="new-task-priority" className="mb-1 block text-xs font-semibold text-on-surface-variant">Priority</label>
            <select id="new-task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriorityName)} className={`${CONTROL_CLASS} w-full`}>
              {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="new-task-due" className="mb-1 block text-xs font-semibold text-on-surface-variant">Due date</label>
            <input id="new-task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className={`${CONTROL_CLASS} w-full`} />
          </div>
        </div>

        {canAssign && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-on-surface-variant">Assignee</label>
            <UserPicker value={assigneeId} onChange={setAssigneeId} users={assignableUsers} allowEmpty emptyLabel="Unassigned" />
          </div>
        )}

        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    </Modal>
  );
}
