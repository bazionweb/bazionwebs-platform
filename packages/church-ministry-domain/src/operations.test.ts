import { describe, expect, it, vi } from "vitest";
import {
  createDepartmentUseCase,
  createSmallGroupUseCase,
  submitGroupJoinRequestUseCase,
  createVolunteerTeamUseCase,
  submitVolunteerApplicationUseCase,
  createInventoryAssetUseCase,
  recordAssetEventUseCase,
  type MinistryOperationsRepository,
} from "./operations.js";
import {
  saveSiteSettingsDraftUseCase,
  publishSiteSettingsDraftUseCase,
  rollbackSiteSettingsVersionUseCase,
  type MinistrySiteSettingsVersionsRepository,
} from "./site-settings-versions.js";

describe("operations domain use cases", () => {
  const mockOpsRepo: MinistryOperationsRepository = {
    listDepartments: vi.fn(),
    createDepartment: vi.fn().mockResolvedValue({ id: "dept-1", slug: "music" }),
    updateDepartment: vi.fn(),
    archiveDepartment: vi.fn(),
    listSmallGroups: vi.fn(),
    createSmallGroup: vi.fn().mockResolvedValue({ id: "group-1", slug: "central-cell" }),
    updateSmallGroup: vi.fn(),
    archiveSmallGroup: vi.fn(),
    listGroupMemberships: vi.fn(),
    createGroupJoinRequest: vi.fn().mockResolvedValue({ id: "mem-1" }),
    updateGroupMembershipStatus: vi.fn(),
    listVolunteerTeams: vi.fn(),
    createVolunteerTeam: vi.fn().mockResolvedValue({ id: "team-1", slug: "media" }),
    updateVolunteerTeam: vi.fn(),
    archiveVolunteerTeam: vi.fn(),
    listVolunteerApplications: vi.fn(),
    createVolunteerApplication: vi.fn().mockResolvedValue({ id: "app-1" }),
    updateVolunteerApplicationStatus: vi.fn(),
    listInventoryAssets: vi.fn(),
    createInventoryAsset: vi.fn().mockResolvedValue({ id: "asset-1" }),
    updateInventoryAsset: vi.fn(),
    archiveInventoryAsset: vi.fn(),
    listAssetEvents: vi.fn(),
    createAssetEvent: vi.fn().mockResolvedValue({ id: "evt-1" }),
    getPublicDirectory: vi.fn(),
  };

  it("slugifies and creates departments", async () => {
    const res = await createDepartmentUseCase(mockOpsRepo, "t-1", {
      name: "Praise & Worship",
      description: "Leading church worship",
    });
    expect(res).toEqual({ id: "dept-1", slug: "music" });
    expect(mockOpsRepo.createDepartment).toHaveBeenCalledWith("t-1", expect.objectContaining({
      name: "Praise & Worship",
      slug: "praise-and-worship",
    }));
  });

  it("submits group join request with required consent", async () => {
    const res = await submitGroupJoinRequestUseCase(mockOpsRepo, "t-1", "g-1", {
      fullName: "Jane Doe",
      email: "jane@test.org",
      telephone: "+254712345678",
      privacyConsent: true,
    });
    expect(res).toEqual({ id: "mem-1" });
  });

  it("creates physical equipment asset", async () => {
    const res = await createInventoryAssetUseCase(mockOpsRepo, "t-1", {
      name: "Yamaha Mixer",
      assetTag: "MIX-01",
      category: "Audio",
      location: "Sanctuary",
      status: "available",
      condition: "good",
    });
    expect(res).toEqual({ id: "asset-1" });
  });
});

describe("site settings versioning domain use cases", () => {
  const mockVersionsRepo: MinistrySiteSettingsVersionsRepository = {
    getLatestPublishedVersion: vi.fn(),
    getCurrentDraft: vi.fn(),
    saveDraft: vi.fn().mockResolvedValue({ versionNumber: 2 }),
    publishDraft: vi.fn().mockResolvedValue({ versionNumber: 2, publishedAt: "2026-11-14T00:00:00Z" }),
    listVersions: vi.fn().mockResolvedValue([]),
    rollbackToVersion: vi.fn().mockResolvedValue({ newVersionNumber: 3, publishedAt: "2026-11-14T00:05:00Z" }),
    discardDraft: vi.fn(),
  };

  it("saves draft and rolls back cleanly", async () => {
    const pubRes = await publishSiteSettingsDraftUseCase(mockVersionsRepo, "t-1", "admin@church.org", "Theme update");
    expect(pubRes.versionNumber).toBe(2);

    const rbRes = await rollbackSiteSettingsVersionUseCase(mockVersionsRepo, "t-1", 1, "admin@church.org", "Undo changes");
    expect(rbRes.newVersionNumber).toBe(3);
    expect(mockVersionsRepo.rollbackToVersion).toHaveBeenCalledWith("t-1", 1, "admin@church.org", "Undo changes");
  });
});

