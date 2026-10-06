import type { TaskSlaState } from '../../lib/tasks/types';
import { TASK_SLA_STYLES } from '../../lib/tasks/format';

interface Props {
  state: TaskSlaState;
}

// SLA is derived from the due date on the server (overdue / due within 24h /
// on track). A task with no due date, or one that is finished, has none — and
// renders nothing, so a completed row never carries a red chip.
export default function TaskSlaChip({ state }: Props) {
  if (state === 'none') return null;
  const style = TASK_SLA_STYLES[state];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-label-sm font-medium ${style.bg} ${style.fg}`}>
      {style.label}
    </span>
  );
}
