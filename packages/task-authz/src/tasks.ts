// ── Tasks authority (Tier C3: capability-driven) ────────────────────────────
// Coarse scope gates ask the DB-resolved capability matrix, not a rank. The
// fine-grained per-task rules (creator / assignee / manager-of-assignee) are
// still enforced in tasks-service against the specific rows — those are
// relationship questions, which no capability can answer.
//
// The actor is anything carrying a resolved capability list: a service's
// `request.auth` or a `SessionUser` from /auth/me. Both come from the same
// matrix, so the Team tab and the call behind it cannot disagree.
import { can, CAPABILITY, ANCHOR_RANK, DEFAULT_ROLE_RANK, type CapabilityHolder } from '@platform/rbac';

/** Retained for SENIORITY questions (manager-of, assignment ceilings) only. */
export const TASK_RANKS = {
  MEMBER: DEFAULT_ROLE_RANK.SALES_REPRESENTATIVE,
  LEAD:   DEFAULT_ROLE_RANK.SENIOR_SALES_EXECUTIVE,
  ADMIN:  ANCHOR_RANK.ORG_ADMIN,
} as const;

/** May request the team/subtree task scope (?scope=team). */
export function canViewTeamTasks(actor: CapabilityHolder): boolean {
  return can(actor, CAPABILITY.TASKS_TEAM_VIEW);
}

/** May request the whole-org task scope (?scope=org). */
export function canViewOrgTasks(actor: CapabilityHolder): boolean {
  return can(actor, CAPABILITY.TASKS_ADMIN);
}

/**
 * May administer any in-org task or task list regardless of ownership —
 * PATCH/DELETE another user's task, delete any list.
 */
export function canAdministerTasks(actor: CapabilityHolder): boolean {
  return can(actor, CAPABILITY.TASKS_ADMIN);
}

/** May assign or reassign a task to someone else. */
export function canAssignTasks(actor: CapabilityHolder): boolean {
  return can(actor, CAPABILITY.TASKS_ASSIGN);
}
