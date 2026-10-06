'use client';

import { useEffect, useState } from 'react';
import { Button, Modal, SpeechInputButton, appendDictation } from '@platform/ui-kit';
import { useTerm } from '@platform/ui-kit/branding';
import { taskLists as taskListsApi } from '../../lib/api/client';
import { taskVisibilityOptions } from '../../lib/tasks/format';
import type { TaskListView, TaskVisibility } from '../../lib/tasks/types';
import { CONTROL_CLASS } from './TaskFilterBar';

interface Props {
  open: boolean;
  /** Present = edit that list; absent = create. */
  list?: TaskListView | undefined;
  onClose: () => void;
  onSaved: () => void;
}

// Create / edit a list and choose who can see it. A branch IS an organization in
// this platform, so the stored value for "Branch" stays `org` — only the label
// changes, and it uses the tenant's own word for branch (Branding > terms).
export default function TaskListFormModal({ open, list, onClose, onSaved }: Props) {
  const term = useTerm();
  const branchWord = term('branch', 'Branch');
  const options = taskVisibilityOptions(branchWord);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<TaskVisibility>('private');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the list being edited (or blank for create) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? '');
    setDescription(list?.description ?? '');
    setVisibility(list?.visibility ?? 'private');
    setError(null);
  }, [open, list]);

  const handleClose = () => {
    if (!saving) onClose();
  };

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const body = { name: name.trim(), description: description.trim() || null, visibility };
      if (list) await taskListsApi.update(list.id, body);
      else await taskListsApi.create(body);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${list ? 'save' : 'create'} the list.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={list ? 'Edit list' : 'New list'}
      maxWidth="max-w-lg"
      locked={saving}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="md" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" size="md" onClick={() => void submit()} disabled={saving || !name.trim()}>
            {saving ? 'Saving…' : list ? 'Save list' : 'Create list'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="list-name" className="block text-xs font-semibold text-on-surface-variant">Name</label>
            <span className="text-label-sm tabular-nums text-outline">{name.length} / 200</span>
          </div>
          <input
            id="list-name"
            type="text"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q3 onboarding"
            className={`${CONTROL_CLASS} h-auto w-full py-2 text-sm`}
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-2">
            <label htmlFor="list-desc" className="block text-xs font-semibold text-on-surface-variant">Description (optional)</label>
            <SpeechInputButton onText={(t) => setDescription((p) => appendDictation(p, t, 2000))} disabled={saving} />
          </div>
          <textarea
            id="list-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <fieldset>
          <legend className="mb-2 block text-xs font-semibold text-on-surface-variant">Who can see this list?</legend>
          <div className="space-y-2">
            {options.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  visibility === opt.value ? 'border-primary bg-primary-fixed/40' : 'border-outline-variant hover:bg-surface-container-low'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                  className="mt-0.5 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-on-surface">{opt.label}</span>
                  <span className="block text-xs text-on-surface-variant">{opt.help}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    </Modal>
  );
}
