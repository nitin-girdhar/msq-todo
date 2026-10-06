import type { TaskStatusName } from '../../lib/tasks/types';
import { TASK_STATUS_STYLES } from '../../lib/tasks/format';

interface Props {
  status: TaskStatusName;
  label?: string;
}

export default function TaskStatusChip({ status, label }: Props) {
  const style = TASK_STATUS_STYLES[status] ?? TASK_STATUS_STYLES.todo;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-label-sm font-medium ${style.bg} ${style.fg}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      {label ?? status}
    </span>
  );
}
