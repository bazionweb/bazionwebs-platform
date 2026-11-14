import {
  type DepartmentInput,
  type DepartmentUpdate,
  type SmallGroupInput,
  type SmallGroupUpdate,
  type PublicGroupJoinRequest,
  type GroupMembershipStatusUpdate,
  type VolunteerTeamInput,
  type VolunteerTeamUpdate,
  type PublicVolunteerApplication,
  type VolunteerApplicationStatusUpdate,
  type InventoryAssetInput,
  type InventoryAssetUpdate,
  type InventoryAssetEventInput,
  type PublicChurchDirectory,
  departmentInputSchema,
  departmentUpdateSchema,
  smallGroupInputSchema,
  smallGroupUpdateSchema,
  publicGroupJoinRequestSchema,
  groupMembershipStatusUpdateSchema,
  volunteerTeamInputSchema,
  volunteerTeamUpdateSchema,
  publicVolunteerApplicationSchema,
  volunteerApplicationStatusUpdateSchema,
  inventoryAssetInputSchema,
  inventoryAssetUpdateSchema,
  inventoryAssetEventInputSchema,
} from "@bazion/church-ministry-contracts";
import { slugifyContentTitle } from "./index.js";

export interface MinistryOperationsRepository {
  listDepartments(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    description: string;
    icon: string | null;
    leaderName: string | null;
    leaderRole: string | null;
    meetingSchedule: string | null;
    contactEmail: string | null;
    isPublic: boolean;
    displayOrder: number;
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
  }>>;
  createDepartment(tenantId: string, input: DepartmentInput & { slug: string }): Promise<{ id: string; slug: string }>;
  updateDepartment(tenantId: string, id: string, input: DepartmentUpdate): Promise<void>;
  archiveDepartment(tenantId: string, id: string): Promise<void>;

  listSmallGroups(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    category: string;
    description: string | null;
    leaderName: string;
    meetingSchedule: string;
    publicLocationLabel: string;
    privateAddress: string | null;
    departmentId: string | null;
    capacity: number | null;
    isPublic: boolean;
    acceptingMembers: boolean;
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
  }>>;
  createSmallGroup(tenantId: string, input: SmallGroupInput & { slug: string }): Promise<{ id: string; slug: string }>;
  updateSmallGroup(tenantId: string, id: string, input: SmallGroupUpdate): Promise<void>;
  archiveSmallGroup(tenantId: string, id: string): Promise<void>;

  listGroupMemberships(tenantId: string, groupId?: string): Promise<Array<{
    id: string;
    groupId: string;
    groupName: string;
    fullName: string;
    email: string;
    telephone: string;
    role: "member" | "leader" | "host";
    status: "requested" | "active" | "inactive" | "declined";
    privacyConsentAt: string;
    notes: string | null;
    createdAt: string;
  }>>;
  createGroupJoinRequest(tenantId: string, groupId: string, input: PublicGroupJoinRequest): Promise<{ id: string }>;
  updateGroupMembershipStatus(tenantId: string, membershipId: string, input: GroupMembershipStatusUpdate): Promise<void>;

  listVolunteerTeams(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    slug: string;
    departmentId: string | null;
    departmentName: string | null;
    description: string;
    requirements: string | null;
    coordinatorName: string | null;
    isPublic: boolean;
    acceptingApplications: boolean;
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
  }>>;
  createVolunteerTeam(tenantId: string, input: VolunteerTeamInput & { slug: string }): Promise<{ id: string; slug: string }>;
  updateVolunteerTeam(tenantId: string, id: string, input: VolunteerTeamUpdate): Promise<void>;
  archiveVolunteerTeam(tenantId: string, id: string): Promise<void>;

  listVolunteerApplications(tenantId: string, teamId?: string): Promise<Array<{
    id: string;
    teamId: string;
    teamName: string;
    fullName: string;
    email: string;
    telephone: string;
    availability: string | null;
    message: string | null;
    status: "pending" | "approved" | "declined" | "withdrawn";
    privacyConsentAt: string;
    reviewedAt: string | null;
    reviewedBy: string | null;
    notes: string | null;
    createdAt: string;
  }>>;
  createVolunteerApplication(tenantId: string, teamId: string, input: PublicVolunteerApplication): Promise<{ id: string }>;
  updateVolunteerApplicationStatus(tenantId: string, applicationId: string, input: VolunteerApplicationStatusUpdate, reviewedBy?: string): Promise<void>;

  listInventoryAssets(tenantId: string): Promise<Array<{
    id: string;
    name: string;
    assetTag: string;
    category: string;
    location: string;
    condition: "excellent" | "good" | "fair" | "needs_repair" | "retired";
    status: "available" | "in_use" | "maintenance" | "reserved" | "retired";
    assignedTo: string | null;
    acquiredOn: string | null;
    purchaseValueMinor: number | null;
    currency: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>>;
  createInventoryAsset(tenantId: string, input: InventoryAssetInput): Promise<{ id: string }>;
  updateInventoryAsset(tenantId: string, id: string, input: InventoryAssetUpdate): Promise<void>;
  archiveInventoryAsset(tenantId: string, id: string): Promise<void>;

  listAssetEvents(tenantId: string, assetId: string): Promise<Array<{
    id: string;
    assetId: string;
    eventType: "maintenance" | "assignment" | "condition_change" | "reservation" | "note";
    description: string;
    recordedBy: string;
    occurredAt: string;
    createdAt: string;
  }>>;
  createAssetEvent(tenantId: string, assetId: string, input: InventoryAssetEventInput): Promise<{ id: string }>;

  getPublicDirectory(tenantId: string): Promise<PublicChurchDirectory>;
}

export async function createDepartmentUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  rawInput: unknown,
) {
  const parsed = departmentInputSchema.parse(rawInput);
  const slug = parsed.slug || slugifyContentTitle(parsed.name, "department");
  return repository.createDepartment(tenantId, { ...parsed, slug });
}

export async function createSmallGroupUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  rawInput: unknown,
) {
  const parsed = smallGroupInputSchema.parse(rawInput);
  const slug = parsed.slug || slugifyContentTitle(parsed.name, "group");
  return repository.createSmallGroup(tenantId, { ...parsed, slug });
}

export async function submitGroupJoinRequestUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  groupId: string,
  rawInput: unknown,
) {
  const parsed = publicGroupJoinRequestSchema.parse(rawInput);
  return repository.createGroupJoinRequest(tenantId, groupId, parsed);
}

export async function createVolunteerTeamUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  rawInput: unknown,
) {
  const parsed = volunteerTeamInputSchema.parse(rawInput);
  const slug = parsed.slug || slugifyContentTitle(parsed.name, "volunteer-team");
  return repository.createVolunteerTeam(tenantId, { ...parsed, slug });
}

export async function submitVolunteerApplicationUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  teamId: string,
  rawInput: unknown,
) {
  const parsed = publicVolunteerApplicationSchema.parse(rawInput);
  return repository.createVolunteerApplication(tenantId, teamId, parsed);
}

export async function createInventoryAssetUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  rawInput: unknown,
) {
  const parsed = inventoryAssetInputSchema.parse(rawInput);
  return repository.createInventoryAsset(tenantId, parsed);
}

export async function recordAssetEventUseCase(
  repository: MinistryOperationsRepository,
  tenantId: string,
  assetId: string,
  rawInput: unknown,
) {
  const parsed = inventoryAssetEventInputSchema.parse(rawInput);
  return repository.createAssetEvent(tenantId, assetId, parsed);
}

