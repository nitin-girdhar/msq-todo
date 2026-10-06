'use client';

import { useState } from 'react';
import { SpeechInputButton, appendDictation } from '@platform/ui-kit';
import { TASK_PRIORITY_OPTIONS, dueDateToISO } from '../../lib/tasks/format';
import type { TaskPriorityName } from '../../lib/tasks/types';
import { CONTROL_CLASS } from './TaskFilterBar';

export interface QuickAddValues {
  title: string;
  priority_name: TaskPriorityName;
  /** End of the chosen day (local), or null for no due date. */
  due_at: string | null;
}

interface Props {
  onCreate: (values: QuickAddValues) => Promise<void>;
}

// Stitch's quick-add strip: title + dictation (EN/HI) + priority + due date +
// Create. Enter in the title field creates, as before.
export default function TaskQuickAdd({ onCreate }: Props) {
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<TaskPriorityName>('medium');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const title = value.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await onCreate({ title, priority_name: priority, due_at: dueDateToISO(due) });
      setValue('');
      setDue('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 shadow-card">
      <svg className="h-4 w-4 shrink-0 text-outline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        disabled={busy}
        maxLength={500}
        aria-label="New task title"
        placeholder="Quick-add a task and press Enter…"
        className="min-w-[10rem] flex-1 border-none bg-transparent text-sm text-on-surface placeholder:text-outline focus:outline-none"
      />
      <SpeechInputButton onText={(t) => setValue((p) => appendDictation(p, t, 500))} disabled={busy} compact />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as TaskPriorityName)}
        aria-label="Priority for the new task"
        className={CONTROL_CLASS}
      >
        {TASK_PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        type="date"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label="Due date for the new task"
        className={CONTROL_CLASS}
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || !value.trim()}
        className="h-[34px] rounded-lg bg-primary px-4 text-xs font-semibold text-on-primary hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Adding…' : 'Create'}
      </button>
    </div>
  );
}
