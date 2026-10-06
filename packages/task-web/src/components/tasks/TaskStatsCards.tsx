'use client';

import type { TaskStats } from '../../lib/tasks/types';
import type { TaskScope } from '../../hooks/useTaskBoard';

// Which tile is "selected" is derived from the filters by the shell, so a tile
// stays lit when the same filter is set from the filter bar.
export type TaskTileId = 'all' | 'todo' | 'in_progress' | 'blocked' | 'overdue' | 'unassigned';

interface Tone {
  accent: string;
  bar: string;
  alert?: boolean;
}

const TONES = {
  total: { accent: 'text-primary', bar: 'bg-primary' },
  todo: { accent: 'text-cat-slate', bar: 'bg-cat-slate' },
  progress: { accent: 'text-status-info', bar: 'bg-status-info' },
  blocked: { accent: 'text-cat-orange', bar: 'bg-cat-orange' },
  overdue: { accent: 'text-status-overdue', bar: 'bg-status-overdue', alert: true },
  unassigned: { accent: 'text-on-surface-variant', bar: 'bg-outline' },
  health: { accent: 'text-status-success', bar: 'bg-status-success' },
} satisfies Record<string, Tone>;

interface TileProps {
  label: string;
  count: number | string;
  hint: string;
  /** 0-100 fill for the bar under the number. */
  pct: number;
  tone: Tone;
  tileId?: TaskTileId;
  active: TaskTileId;
  onSelect: (tile: TaskTileId) => void;
}

// One KPI tile. A tile with a `tileId` is a button that filters the list to that
// bucket (clicking the active one again resets it — the shell handles that); one
// without is a plain read-out.
function Tile({ label, count, hint, pct, tone, tileId, active, onSelect }: TileProps) {
  const alert = tone.alert === true && Number(count) > 0;
  const isActive = tileId !== undefined && active === tileId;
  const body = (
    <>
      <span className={`text-label-sm uppercase tracking-wider ${alert ? 'text-on-status-overdue-container' : 'text-outline'}`}>
        {label}
      </span>
      <span className={`text-headline-lg font-bold tabular-nums ${alert ? 'text-status-overdue' : 'text-on-surface'}`}>
        {count}
      </span>
      <span className={`truncate text-body-sm ${alert ? 'text-on-status-overdue-container' : 'text-on-surface-variant'}`}>
        {hint}
      </span>
      <span className="h-1 w-full overflow-hidden rounded-full bg-surface-container" aria-hidden>
        <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }} />
      </span>
    </>
  );
  const base = `flex min-w-0 flex-col gap-1 rounded-xl p-3 text-left ${
    alert ? 'bg-status-overdue-container/60' : 'bg-surface-container-lowest'
  }`;

  if (tileId === undefined) return <div className={`${base} shadow-card`}>{body}</div>;
  return (
    <button
      type="button"
      onClick={() => onSelect(tileId)}
      aria-pressed={isActive}
      className={`${base} cursor-pointer transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
        isActive ? 'shadow-card ring-2 ring-primary' : 'shadow-card hover:shadow-overlay'
      }`}
    >
      {body}
    </button>
  );
}

interface Props {
  scope: TaskScope;
  stats: TaskStats | null;
  active: TaskTileId;
  onSelect: (tile: TaskTileId) => void;
}

const pctOf = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

export default function TaskStatsCards({ scope, stats, active, onSelect }: Props) {
  const s: TaskStats = stats ?? {
    open: 0, todo: 0, in_progress: 0, blocked: 0, completed: 0, overdue: 0, due_soon: 0, unassigned: 0,
  };
  const common = { active, onSelect };

  if (scope === 'own') {
    return (
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Total assigned" count={s.open} hint={`${s.completed} completed`} pct={100} tone={TONES.total} tileId="all" {...common} />
        <Tile label="In progress" count={s.in_progress} hint={`${pctOf(s.in_progress, s.open)}% of open`} pct={pctOf(s.in_progress, s.open)} tone={TONES.progress} tileId="in_progress" {...common} />
        <Tile label="Blocked" count={s.blocked} hint="Waiting on someone" pct={pctOf(s.blocked, s.open)} tone={TONES.blocked} tileId="blocked" {...common} />
        <Tile label="SLA critical" count={s.overdue} hint={s.due_soon > 0 ? `${s.due_soon} more due within 24h` : 'Past their due date'} pct={pctOf(s.overdue, s.open)} tone={TONES.overdue} tileId="overdue" {...common} />
      </div>
    );
  }

  // Team: SLA health is the share of open work not yet past its due date.
  const health = s.open > 0 ? 100 - pctOf(s.overdue, s.open) : 100;
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
      <Tile label="In progress" count={s.in_progress} hint="Active workloads" pct={pctOf(s.in_progress, s.open)} tone={TONES.progress} tileId="in_progress" {...common} />
      <Tile label="To do backlog" count={s.todo} hint="Triage & pending intake" pct={pctOf(s.todo, s.open)} tone={TONES.todo} tileId="todo" {...common} />
      <Tile label="Unassigned" count={s.unassigned} hint="No owner yet" pct={pctOf(s.unassigned, s.open)} tone={TONES.unassigned} tileId="unassigned" {...common} />
      <Tile label="Escalations" count={s.overdue} hint="Past their due date" pct={pctOf(s.overdue, s.open)} tone={TONES.overdue} tileId="overdue" {...common} />
      <Tile label="SLA health" count={`${health}%`} hint="Open work on track" pct={health} tone={TONES.health} active={active} onSelect={onSelect} />
    </div>
  );
}
