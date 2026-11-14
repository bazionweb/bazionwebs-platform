import { z } from "zod";

export const departmentInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a valid lowercase kebab-case slug.").optional(),
  description: z.string().trim().min(2).max(2000),
  icon: z.string().trim().max(32).optional(),
  leaderName: z.string().trim().max(160).optional(),
  leaderRole: z.string().trim().max(120).optional(),
  meetingSchedule: z.string().trim().max(200).optional(),
  contactEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
  isPublic: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(1000).default(0),
  status: z.enum(["active", "archived"]).default("active"),
});
export type DepartmentInput = z.infer<typeof departmentInputSchema>;

export const departmentUpdateSchema = departmentInputSchema.partial();
export type DepartmentUpdate = z.infer<typeof departmentUpdateSchema>;

export const smallGroupInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a valid lowercase kebab-case slug.").optional(),
  category: z.string().trim().min(2).max(80).default("Home Fellowship"),
  description: z.string().trim().max(2000).optional(),
  leaderName: z.string().trim().min(2).max(160),
  meetingSchedule: z.string().trim().min(2).max(200),
  publicLocationLabel: z.string().trim().min(2).max(300),
  privateAddress: z.string().trim().max(500).optional(),
  departmentId: z.string().uuid().optional().nullable(),
  capacity: z.number().int().positive().max(1000).optional(),
  isPublic: z.boolean().default(true),
  acceptingMembers: z.boolean().default(true),
  status: z.enum(["active", "archived"]).default("active"),
});
export type SmallGroupInput = z.infer<typeof smallGroupInputSchema>;

export const smallGroupUpdateSchema = smallGroupInputSchema.partial();
export type SmallGroupUpdate = z.infer<typeof smallGroupUpdateSchema>;

export const publicGroupJoinRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  telephone: z.string().trim().min(6).max(30),
  notes: z.string().trim().max(1000).optional(),
  privacyConsent: z.literal(true),
});
export type PublicGroupJoinRequest = z.infer<typeof publicGroupJoinRequestSchema>;

export const groupMembershipStatusUpdateSchema = z.object({
  status: z.enum(["requested", "active", "inactive", "declined"]),
  role: z.enum(["member", "leader", "host"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type GroupMembershipStatusUpdate = z.infer<typeof groupMembershipStatusUpdateSchema>;

export const volunteerTeamInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a valid lowercase kebab-case slug.").optional(),
  departmentId: z.string().uuid().optional().nullable(),
  description: z.string().trim().min(2).max(2000),
  requirements: z.string().trim().max(1000).optional(),
  coordinatorName: z.string().trim().max(160).optional(),
  isPublic: z.boolean().default(true),
  acceptingApplications: z.boolean().default(true),
  status: z.enum(["active", "archived"]).default("active"),
});
export type VolunteerTeamInput = z.infer<typeof volunteerTeamInputSchema>;

export const volunteerTeamUpdateSchema = volunteerTeamInputSchema.partial();
export type VolunteerTeamUpdate = z.infer<typeof volunteerTeamUpdateSchema>;

export const publicVolunteerApplicationSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  telephone: z.string().trim().min(6).max(30),
  availability: z.string().trim().min(2).max(300).optional(),
  message: z.string().trim().max(2000).optional(),
  privacyConsent: z.literal(true),
});
export type PublicVolunteerApplication = z.infer<typeof publicVolunteerApplicationSchema>;

export const volunteerApplicationStatusUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "declined", "withdrawn"]),
  notes: z.string().trim().max(1000).optional(),
});
export type VolunteerApplicationStatusUpdate = z.infer<typeof volunteerApplicationStatusUpdateSchema>;

export const inventoryAssetInputSchema = z.object({
  name: z.string().trim().min(2).max(160),
  assetTag: z.string().trim().min(2).max(60),
  category: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(180).default("Main Campus"),
  condition: z.enum(["excellent", "good", "fair", "needs_repair", "retired"]).default("good"),
  status: z.enum(["available", "in_use", "maintenance", "reserved", "retired"]).default("available"),
  assignedTo: z.string().trim().max(160).optional(),
  acquiredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date format.").optional(),
  purchaseValueMinor: z.number().int().min(0).max(1000000000).optional(),
  currency: z.string().trim().length(3).default("KES"),
  notes: z.string().trim().max(2000).optional(),
});
export type InventoryAssetInput = z.infer<typeof inventoryAssetInputSchema>;

export const inventoryAssetUpdateSchema = inventoryAssetInputSchema.partial();
export type InventoryAssetUpdate = z.infer<typeof inventoryAssetUpdateSchema>;

export const inventoryAssetEventInputSchema = z.object({
  eventType: z.enum(["maintenance", "assignment", "condition_change", "reservation", "note"]),
  description: z.string().trim().min(2).max(2000),
  recordedBy: z.string().trim().min(2).max(160),
  occurredAt: z.string().datetime().optional(),
});
export type InventoryAssetEventInput = z.infer<typeof inventoryAssetEventInputSchema>;

export const publicChurchDirectorySchema = z.object({
  departments: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    icon: z.string().nullable().optional(),
    leaderName: z.string().nullable().optional(),
    leaderRole: z.string().nullable().optional(),
    meetingSchedule: z.string().nullable().optional(),
  })),
  smallGroups: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    category: z.string(),
    description: z.string().nullable().optional(),
    leaderName: z.string(),
    meetingSchedule: z.string(),
    publicLocationLabel: z.string(),
    acceptingMembers: z.boolean(),
  })),
  volunteerTeams: z.array(z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    departmentName: z.string().nullable().optional(),
    description: z.string(),
    requirements: z.string().nullable().optional(),
    coordinatorName: z.string().nullable().optional(),
    acceptingApplications: z.boolean(),
  })),
});
export type PublicChurchDirectory = z.infer<typeof publicChurchDirectorySchema>;

