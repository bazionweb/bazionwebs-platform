import { describe, expect, it } from "vitest";
import {
  departmentInputSchema,
  smallGroupInputSchema,
  publicGroupJoinRequestSchema,
  volunteerTeamInputSchema,
  publicVolunteerApplicationSchema,
  inventoryAssetInputSchema,
  inventoryAssetEventInputSchema,
  publicChurchDirectorySchema,
} from "./operations.js";

describe("church ministry operations contracts", () => {
  it("validates department inputs", () => {
    const valid = departmentInputSchema.safeParse({
      name: "Intercession Force",
      description: "Dedicated prayer team standing in the gap.",
      leaderName: "Pastor Betty",
    });
    expect(valid.success).toBe(true);

    const invalid = departmentInputSchema.safeParse({
      name: "",
      description: "",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates small group inputs and public join request", () => {
    const group = smallGroupInputSchema.safeParse({
      name: "Central Cell",
      leaderName: "Elder Mwangi",
      meetingSchedule: "Wednesdays 6 PM",
      publicLocationLabel: "Kiamariga Town",
      privateAddress: "House 42, Private Lane",
    });
    expect(group.success).toBe(true);

    const joinReq = publicGroupJoinRequestSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@example.com",
      telephone: "+254712345678",
      privacyConsent: true,
    });
    expect(joinReq.success).toBe(true);

    const noConsent = publicGroupJoinRequestSchema.safeParse({
      fullName: "Jane Doe",
      email: "jane@example.com",
      telephone: "+254712345678",
      privacyConsent: false,
    });
    expect(noConsent.success).toBe(false);
  });

  it("validates volunteer team and application with consent", () => {
    const app = publicVolunteerApplicationSchema.safeParse({
      fullName: "John Kamau",
      email: "john@example.com",
      telephone: "+254722000000",
      availability: "Sundays",
      privacyConsent: true,
    });
    expect(app.success).toBe(true);
  });

  it("validates physical inventory equipment and maintenance event", () => {
    const asset = inventoryAssetInputSchema.safeParse({
      name: "Digital Sound Console",
      assetTag: "AUD-001",
      category: "Audio",
      location: "Sanctuary",
      status: "available",
      condition: "excellent",
    });
    expect(asset.success).toBe(true);

    const event = inventoryAssetEventInputSchema.safeParse({
      eventType: "maintenance",
      description: "Replaced fader ribbons and tested channels 1-32.",
      recordedBy: "Brother Stephen",
    });
    expect(event.success).toBe(true);
  });

  it("validates public directory output structure excluding inventory and private details", () => {
    const directory = publicChurchDirectorySchema.safeParse({
      departments: [{
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Worship",
        slug: "worship",
        description: "Praise and worship team",
      }],
      smallGroups: [{
        id: "123e4567-e89b-12d3-a456-426614174001",
        name: "North Circle",
        slug: "north-circle",
        category: "Cell",
        leaderName: "David",
        meetingSchedule: "Tuesdays 7pm",
        publicLocationLabel: "North Hall",
        acceptingMembers: true,
      }],
      volunteerTeams: [{
        id: "123e4567-e89b-12d3-a456-426614174002",
        name: "Media Crew",
        slug: "media-crew",
        description: "Camera and livestream operators",
        acceptingApplications: true,
      }],
    });
    expect(directory.success).toBe(true);
  });
});

