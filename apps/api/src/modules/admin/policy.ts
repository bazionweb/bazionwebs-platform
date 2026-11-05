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
