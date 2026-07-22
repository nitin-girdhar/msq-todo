import type { SessionUser } from '@platform/types';

// Task assignment is hidden for the two lowest CRM tiers: read_only and
// sales_representative may not assign or reassign tasks (they can still work
// tasks assigned to them). Everyone at senior_sales_executive and above may
// assign — see getAssignableUsers' 'collaboration' scope for who they can pick.
const NON_ASSIGNERS: ReadonlyArray<SessionUser['role']> = ['read_only', 'sales_representative'];

export function canAssignTasks(actor: Pick<SessionUser, 'role'>): boolean {
  return !NON_ASSIGNERS.includes(actor.role);
}
