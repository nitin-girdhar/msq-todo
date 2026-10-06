import { CAPABILITY } from '@platform/rbac';
import type { NavItem } from '@platform/ui-kit/shell';

// Task product nav (Stitch: My Tasks / Team Tasks / Lists & Scopes). Each entry
// carries the capability of the page it leads to, so the rail and the guard on
// the page read the same key; the pages and tasks-service re-check on their own.
//
// Never rename an id: tenant branding overrides are keyed by it, and each one is
// listed in msq-core/packages/ui/src/branding/catalog.ts.
export const TASK_NAV: readonly NavItem[] = [
  { id: 'tasks',       label: 'My Tasks',       href: '/tasks',       icon: 'square-check-big', capability: CAPABILITY.TASKS },
  // tasks.view.team is a scope with nothing beneath it (like an operation), so it
  // needs `exact` — holdsUsableNode() would demand a granted descendant and hide
  // the item from everyone, admins included.
  { id: 'tasks-team',  label: 'Team Tasks',     href: '/tasks/team',  icon: 'users-round',      capability: CAPABILITY.TASKS_VIEW_TEAM, exact: true },
  { id: 'tasks-lists', label: 'Lists & Scopes', href: '/tasks/lists', icon: 'list-checks',      capability: CAPABILITY.TASKS_LISTS },
] as const;

// Phone bottom tab bar: one tab per nav id (each tab lists ids in preference
// order — the first the actor may open wins). A user without the team scope or
// the lists page simply sees fewer tabs.
export const MOBILE_TABS: readonly (readonly string[])[] = [
  ['tasks'],
  ['tasks-team'],
  ['tasks-lists'],
];
