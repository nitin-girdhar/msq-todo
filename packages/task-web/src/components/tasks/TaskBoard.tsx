'use client';

import { useState } from 'react';
import type { TaskStatusName, TaskView } from '../../lib/tasks/types';
import { TASK_STATUS_OPTIONS, TASK_STATUS_STYLES, formatDueDate, initialsOf, taskCode } from '../../lib/tasks/format';
import TaskPriorityBadge from './TaskPriorityBadge';
import TaskSlaChip from './TaskSlaChip';

interface Props {
  tasks: TaskView[];
  /** Finished columns (Done / Cancelled) only appear when completed tasks are loaded. */
  includeCompleted: boolean;
  onOpen: (task: TaskView) => void;
  /** Move a card to another status. Rejects on a stale card (409) — the shell refetches. */
  onMove: (task: TaskView, status: TaskStatusName) => Promise<void>;
}

const OPEN_STATUSES: TaskStatusName[] = ['todo', 'in_progress', 'blocked'];

export default function TaskBoard({ tasks, includeCompleted, onOpen, onMove }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatusName | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const columns = TASK_STATUS_OPTIONS.filter((o) => includeCompleted || OPEN_STATUSES.includes(o.value));

  const move = async (task: TaskView, status: TaskStatusName) => {
    if (task.status_name === status || movingId) return;
    setMovingId(task.id);
    try {
      await onMove(task, status);
    } finally {
      setMovingId(null);
    }
  };

  const onDrop = (status: TaskStatusName) => {
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    setOverColumn(null);
    if (task) void move(task, status);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((col) => {
        const cards = tasks.filter((t) => t.status_name === col.value);
        const style = TASK_STATUS_STYLES[col.value];
        const isOver = overColumn === col.value && dragId !== null;
        return (
          <section
            key={col.value}
            aria-label={`${col.label}, ${cards.length} tasks`}
            onDragOver={(e) => { e.preventDefault(); setOverColumn(col.value); }}
            onDragLeave={() => setOverColumn((c) => (c === col.value ? null : c))}
            onDrop={(e) => { e.preventDefault(); onDrop(col.value); }}
            className={`flex w-72 shrink-0 flex-col gap-2 rounded-xl bg-surface-container-low p-2 ${
              isOver ? 'ring-2 ring-primary' : ''
            }`}
          >
            <header className="flex items-center justify-between px-1 pt-1">
              <span className="flex items-center gap-2 text-label-md font-semibold text-on-surface">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                {col.label}
              </span>
              <span className="rounded-full bg-surface-container px-2 text-label-sm tabular-nums text-on-surface-variant">{cards.length}</span>
            </header>

            {cards.length === 0 && (
              <p className="rounded-lg border border-dashed border-outline-variant px-3 py-6 text-center text-body-sm text-outline">
                Nothing here
              </p>
            )}

            {cards.map((t) => (
              <article
                key={t.id}
                draggable
                onDragStart={(e) => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => { setDragId(null); setOverColumn(null); }}
                className={`flex cursor-grab flex-col gap-2 rounded-lg bg-surface-container-lowest p-3 shadow-card active:cursor-grabbing ${
                  dragId === t.id || movingId === t.id ? 'opacity-50' : ''
                } ${t.sla_state === 'overdue' ? 'ring-1 ring-status-overdue/40' : ''}`}
              >
                <button type="button" onClick={() => onOpen(t)} className="text-left">
                  <span className="font-mono text-label-sm text-on-surface-variant">{taskCode(t.task_no)}</span>
                  <span className={`mt-0.5 block text-body-md font-medium ${t.status_is_terminal ? 'text-outline line-through' : 'text-on-surface'}`}>
                    {t.title}
                  </span>
                  {t.list_name && <span className="block truncate text-label-sm text-on-surface-variant">{t.list_name}</span>}
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  {t.priority_name && <TaskPriorityBadge priority={t.priority_name} label={t.priority_label} />}
                  <TaskSlaChip state={t.sla_state} />
                  {t.due_at && <span className="text-label-sm tabular-nums text-on-surface-variant">{formatDueDate(t.due_at)}</span>}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-label-sm text-on-surface-variant">
                    {t.assignee_name ? (
                      <>
                        <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-[0.5625rem] font-semibold text-on-primary-fixed-variant">
                          {initialsOf(t.assignee_name)}
                        </span>
                        <span className="truncate">{t.assignee_name}</span>
                      </>
                    ) : (
                      <span className="italic text-outline">Unassigned</span>
                    )}
                  </span>
                  {/* Keyboard / touch alternative to dragging. */}
                  <select
                    value={t.status_name}
                    onChange={(e) => void move(t, e.target.value as TaskStatusName)}
                    disabled={movingId !== null}
                    aria-label={`Move ${t.title} to another status`}
                    className="h-7 max-w-[7rem] rounded-md border border-outline-variant bg-surface-container-lowest px-1 text-label-sm text-on-surface focus:border-primary focus:outline-none"
                  >
                    {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
