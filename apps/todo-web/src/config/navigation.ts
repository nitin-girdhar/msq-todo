import { CAPABILITY } from '@platform/rbac';
import type { NavItem } from '@platform/ui-kit/shell';

// Task product nav. The team view is gated inside the page on tasks.view.team;
// the top rail carries the single Tasks entry, shown to anyone granted the tool.
//
// Tier C3: previously `roles: ROLES`, i.e. visible to everyone with the module.
export const TASK_NAV: readonly NavItem[] = [
  { id: 'tasks', label: 'Tasks', href: '/tasks', capability: CAPABILITY.TASKS },
] as const;
