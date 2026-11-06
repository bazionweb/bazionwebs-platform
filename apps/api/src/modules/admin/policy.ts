import { z } from "zod";

export const clientAssignableRoles = [
  "admin",
  "member",
  "catalogManager",
  "orderManager",
  "contentEditor",
  "viewer",
] as const;

export const invitationInputSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(clientAssignableRoles),
});

export const memberRoleInputSchema = z.object({
  role: z.enum(clientAssignableRoles),
});

export const memberListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const provisioningReconciliationInputSchema = z.object({
  staleMinutes: z.coerce.number().int().min(5).max(1_440).default(10),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();


export const platformTenantListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(["provisioning", "active", "suspended", "closed"]).optional(),
}).strict();

export const platformTenantLifecycleInputSchema = z.object({
  action: z.enum(["suspend", "restore", "close"]),
}).strict();


export const platformTenantOwnerTransferInputSchema = z.object({
  targetUserId: z.string().trim().min(1).max(128),
}).strict();
