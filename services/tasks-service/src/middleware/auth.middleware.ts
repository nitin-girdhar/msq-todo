import type { FastifyRequest } from 'fastify';
import { readAuthContext } from '@platform/service-auth';
import { resolveGlobalRole, capabilitiesFor } from '@platform/db';
import { hasOrgAccess, can, CAPABILITY } from '@platform/rbac';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

const INTERNAL_SECRET = process.env['INTERNAL_SERVICE_SECRET'];

export async function authenticate(request: FastifyRequest): Promise<void> {
  const result = readAuthContext(request.headers, INTERNAL_SECRET);
  if (!result.ok) throw new UnauthorizedError(result.error);
  const { org_id, user_id, tenant_id, platform_role } = result.auth;

  // Tier C: rank + department come from the ONE iam ladder, so the /tasks/team
  // page guard and this service now agree — previously the page passed on the
  // platform rank while every call 403'd on the separate task.member_roles rank.
  // `role` carries platform_role for withRoleTx PG-role selection.
  const { role: role_name, rank, department } = await resolveGlobalRole(user_id, org_id);
  if (!hasOrgAccess(rank)) {
    throw new ForbiddenError('You do not have an active role in this organization');
  }

  // Tier C3: the DB decides what this role may do; this service and the UI read
  // the SAME resolved list (/auth/me serves it), so they cannot drift.
  const capabilities = await capabilitiesFor(tenant_id, role_name);

  // Replaces task.member_roles' provisioning gate.
  if (!can({ capabilities }, CAPABILITY.TASKS_VIEW)) {
    throw new ForbiddenError('You do not have access to the Tasks product in this organization');
  }

  request.auth = {
    org_id, user_id, tenant_id,
    role: platform_role, role_name, rank, department, capabilities,
  };
}
