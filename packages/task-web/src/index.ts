// @task/web — Task product package. Public surface: the page-level Shells
// apps/web's `(todo)` route group renders, `TaskLeadSection` (the one
// component another product embeds — LMS's LeadEditModal shows a lead's
// linked tasks), the nav-badge chrome the module shell mounts, and the api
// client apps/web's cross-product "My Day" widget needs. Everything else is
// internal to this package.

export { default as TasksShell } from './components/tasks/TasksShell';
export { default as TeamTasksShell } from './components/tasks/TeamTasksShell';
export { default as TaskDetailShell } from './components/tasks/TaskDetailShell';
export { default as TaskListsShell } from './components/tasks/TaskListsShell';
export { default as TaskLeadSection } from './components/tasks/TaskLeadSection';
export { default as TaskNavBadges } from './components/shell/TaskNavBadges';

export { endOfTodayISO } from './lib/tasks/format';
export { tasks, taskLists } from './lib/api/client';
