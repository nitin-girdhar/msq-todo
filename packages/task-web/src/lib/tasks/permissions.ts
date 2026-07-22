// Tier C3: who may assign is the tasks.assign grant in iam.role_capabilities,
// not a hard-coded list of role names. The shipped default reproduces the old
// behaviour exactly — read_only and sales_representative do not hold the key, so
// they never see the control — but a tenant can now change that without a
// deploy. Re-exported from @task/authz so the UI and tasks-service ask the same
// question of the same data.
//
// Who an assigner may PICK is a separate, hierarchy question — see
// getAssignableUsers' 'collaboration' scope.
export { canAssignTasks } from '@task/authz';
