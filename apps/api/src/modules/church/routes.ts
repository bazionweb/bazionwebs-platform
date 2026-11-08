import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import {
  contactMessageSchema,
  donationInitiateSchema,
  eventInputSchema,
  eventRegistrationSchema,
  newsletterSubscribeSchema,
  prayerRequestSchema,
  sermonInputSchema,
} from "@bazion/api-contracts";
import {
  churchContactMessages,
  churchDonations,
  churchEventRegistrations,
  churchEvents,
  churchNewsletterSubscribers,
  churchPaymentTransactions,
  churchPrayerRequests,
  donationCampaigns,
  leadershipProfiles,
  ministryProfiles,
  ministrySettings,
  sermons,
} from "@bazion/database";
import { requireActiveTenantPermission } from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { withTenantTransaction, type TenantTransaction } from "../../lib/database.js";
import { resolveTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";

interface RouteOptions {
  config: AppConfig;
}

async function assertChurchEnabled(tenantId: string): Promise<void> {
  if (!(await isTenantModuleEnabled(tenantId, "church-ministry"))) {
    throw Object.assign(new Error("The church ministry module is not enabled for this tenant."), {
      statusCode: 404,
      code: "CHURCH_MODULE_DISABLED",
    });
  }
}

export async function churchRoutes(app: FastifyInstance, options: RouteOptions) {
  const { config } = options;

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC CHURCH ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /v1/public/church/site
  app.get("/public/church/site", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const [profile] = await tx
        .select()
        .from(ministryProfiles)
        .where(eq(ministryProfiles.tenantId, tenantId))
        .limit(1);

      const leaders = await tx
        .select()
        .from(leadershipProfiles)
        .where(and(eq(leadershipProfiles.tenantId, tenantId), eq(leadershipProfiles.status, "active")))
        .orderBy(leadershipProfiles.displayOrder);

      return reply.send({
        profile: profile ?? null,
        leaders,
      });
    });
  });

  // GET /v1/public/church/sermons
  app.get<{
    Querystring: { search?: string; category?: string; limit?: string; offset?: string };
  }>("/public/church/sermons", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    const limit = Math.min(Math.max(Number.parseInt(request.query.limit ?? "20", 10) || 20, 1), 100);
    const offset = Math.max(Number.parseInt(request.query.offset ?? "0", 10) || 0, 0);
    const search = request.query.search?.trim();

    return withTenantTransaction(tenantId, async (tx) => {
      let conditions = and(eq(sermons.tenantId, tenantId), eq(sermons.status, "published"));
      if (search) {
        conditions = and(
          conditions,
          sql`(${ilike(sermons.title, `%${search}%`)} or ${ilike(sermons.speaker, `%${search}%`)})`
        );
      }

      const items = await tx
        .select()
        .from(sermons)
        .where(conditions)
        .orderBy(desc(sermons.publishedAt), desc(sermons.createdAt))
        .limit(limit)
        .offset(offset);

      const countRows = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(sermons)
        .where(conditions);

      const total = countRows[0]?.total ?? 0;
      return reply.send({ items, total, limit, offset });
    });
  });

  // GET /v1/public/church/sermons/:slug
  app.get<{ Params: { slug: string } }>("/public/church/sermons/:slug", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const [sermon] = await tx
        .select()
        .from(sermons)
        .where(
          and(
            eq(sermons.tenantId, tenantId),
            eq(sermons.slug, request.params.slug),
            eq(sermons.status, "published")
          )
        )
        .limit(1);

      if (!sermon) {
        return reply.code(404).send({ error: "SERMON_NOT_FOUND", message: "Sermon not found." });
      }

      const related = await tx
        .select()
        .from(sermons)
        .where(
          and(
            eq(sermons.tenantId, tenantId),
            eq(sermons.status, "published"),
            sql`${sermons.id} != ${sermon.id}`
          )
        )
        .orderBy(desc(sermons.publishedAt))
        .limit(3);

      return reply.send({ sermon, related });
    });
  });

  // GET /v1/public/church/events
  app.get<{ Querystring: { filter?: "upcoming" | "past" | "all"; limit?: string } }>(
    "/public/church/events",
    async (request, reply) => {
      const tenantId = await resolveTenantId(request.hostname, config);
      await assertChurchEnabled(tenantId);

      const limit = Math.min(Math.max(Number.parseInt(request.query.limit ?? "20", 10) || 20, 1), 50);
      const filter = request.query.filter ?? "all";

      return withTenantTransaction(tenantId, async (tx) => {
        const conditions = [eq(churchEvents.tenantId, tenantId)];
        const now = new Date();

        if (filter === "upcoming") {
          conditions.push(sql`${churchEvents.startsAt} >= ${now}`);
        } else if (filter === "past") {
          conditions.push(sql`${churchEvents.startsAt} < ${now}`);
        }

        const events = await tx
          .select()
          .from(churchEvents)
          .where(and(...conditions))
          .orderBy(filter === "past" ? desc(churchEvents.startsAt) : churchEvents.startsAt)
          .limit(limit);

        return reply.send({ events });
      });
    }
  );

  // GET /v1/public/church/events/:slug
  app.get<{ Params: { slug: string } }>("/public/church/events/:slug", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const [event] = await tx
        .select()
        .from(churchEvents)
        .where(and(eq(churchEvents.tenantId, tenantId), eq(churchEvents.slug, request.params.slug)))
        .limit(1);

      if (!event) {
        return reply.code(404).send({ error: "EVENT_NOT_FOUND", message: "Event not found." });
      }

      return reply.send({ event });
    });
  });

  // POST /v1/public/church/events/:eventId/register
  app.post<{ Params: { eventId: string } }>(
    "/public/church/events/:eventId/register",
    async (request, reply) => {
      const tenantId = await resolveTenantId(request.hostname, config);
      await assertChurchEnabled(tenantId);

      const parsed = eventRegistrationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
      }

      return withTenantTransaction(tenantId, async (tx) => {
        const [event] = await tx
          .select()
          .from(churchEvents)
          .where(and(eq(churchEvents.tenantId, tenantId), eq(churchEvents.id, request.params.eventId)))
          .limit(1);

        if (!event) {
          return reply.code(404).send({ error: "EVENT_NOT_FOUND", message: "Event not found." });
        }

        if (!event.registrationEnabled) {
          return reply
            .code(400)
            .send({ error: "REGISTRATION_CLOSED", message: "Registration is not enabled for this event." });
        }

        // Generate clean unique confirmation reference
        const refCode = `GMFC-REG-${randomBytes(3).toString("hex").toUpperCase()}`;

        const [regRecord] = await tx
          .insert(churchEventRegistrations)
          .values({
            tenantId,
            eventId: event.id,
            fullName: parsed.data.fullName,
            email: parsed.data.email,
            telephone: parsed.data.telephone,
            registrationReference: refCode,
            status: "confirmed",
          })
          .returning();

        if (!regRecord) {
          throw Object.assign(new Error("Failed to create registration record."), { statusCode: 500 });
        }

        return reply.code(201).send({
          success: true,
          registrationReference: regRecord.registrationReference,
          eventTitle: event.title,
          message: "Registration confirmed. We look forward to fellowshipping with you!",
        });
      });
    }
  );

  // GET /v1/public/church/campaigns
  app.get("/public/church/campaigns", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const items = await tx
        .select()
        .from(donationCampaigns)
        .where(and(eq(donationCampaigns.tenantId, tenantId), eq(donationCampaigns.status, "active")))
        .orderBy(desc(donationCampaigns.createdAt));

      return reply.send({ campaigns: items });
    });
  });

  // POST /v1/public/church/donations/mpesa-stk
  app.post("/public/church/donations/mpesa-stk", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    const parsed = donationInitiateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    }

    const amountMinor = Math.round(parsed.data.amount * 100);
    const checkoutRequestId = `ws_CO_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const merchantRequestId = `MERCH_${randomBytes(4).toString("hex")}`;

    return withTenantTransaction(tenantId, async (tx) => {
      const [donation] = await tx
        .insert(churchDonations)
        .values({
          tenantId,
          campaignId: parsed.data.campaignId,
          donorName: parsed.data.donorName,
          donorEmail: parsed.data.donorEmail,
          donorPhone: parsed.data.phoneNumber,
          amountMinor,
          currency: "KES",
          givingCategory: parsed.data.givingCategory,
          paymentMethod: "M-Pesa",
          paymentStatus: "pending",
        })
        .returning();

      if (!donation) {
        throw Object.assign(new Error("Failed to initiate donation record."), { statusCode: 500 });
      }

      await tx.insert(churchPaymentTransactions).values({
        tenantId,
        donationId: donation.id,
        provider: "mpesa-equity",
        checkoutRequestId,
        merchantRequestId,
        amountMinor,
        currency: "KES",
        transactionStatus: "pending",
      });

      return reply.send({
        success: true,
        checkoutRequestId,
        merchantRequestId,
        donationId: donation.id,
        status: "pending",
        message: "M-Pesa STK push initiated. Please check your phone to enter your PIN.",
      });
    });
  });

  // POST /v1/public/church/contact
  app.post("/public/church/contact", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    const parsed = contactMessageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    }

    return withTenantTransaction(tenantId, async (tx) => {
      await tx.insert(churchContactMessages).values({
        tenantId,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        telephone: parsed.data.telephone,
        subject: parsed.data.subject,
        message: parsed.data.message,
        category: parsed.data.category ?? "General Enquiry",
        status: "new",
      });

      return reply.code(201).send({
        success: true,
        message: "Thank you for reaching out. The ministry secretariat has received your enquiry.",
      });
    });
  });

  // POST /v1/public/church/prayer-requests
  app.post("/public/church/prayer-requests", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    const parsed = prayerRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    }

    return withTenantTransaction(tenantId, async (tx) => {
      await tx.insert(churchPrayerRequests).values({
        tenantId,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        telephone: parsed.data.telephone,
        requestText: parsed.data.requestText,
        privacyPreference: parsed.data.privacyPreference ?? "confidential",
        status: "received",
      });

      return reply.code(201).send({
        success: true,
        message: "Your prayer request has been received. Our intercessory team is lifting you up in prayer.",
      });
    });
  });

  // POST /v1/public/church/newsletter
  app.post("/public/church/newsletter", async (request, reply) => {
    const tenantId = await resolveTenantId(request.hostname, config);
    await assertChurchEnabled(tenantId);

    const parsed = newsletterSubscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    }

    return withTenantTransaction(tenantId, async (tx) => {
      await tx
        .insert(churchNewsletterSubscribers)
        .values({
          tenantId,
          email: parsed.data.email.toLowerCase().trim(),
          status: "active",
        })
        .onConflictDoNothing();

      return reply.send({
        success: true,
        message: "You are successfully subscribed to Global Mission updates and devotionals.",
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PROTECTED CHURCH ADMIN ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /v1/admin/church/overview
  app.get("/admin/church/overview", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [sermonRow] = await tx
        .select({ sermonCount: sql<number>`count(*)::int` })
        .from(sermons)
        .where(eq(sermons.tenantId, context.tenantId));

      const [eventRow] = await tx
        .select({ eventCount: sql<number>`count(*)::int` })
        .from(churchEvents)
        .where(eq(churchEvents.tenantId, context.tenantId));

      const [regRow] = await tx
        .select({ registrationCount: sql<number>`count(*)::int` })
        .from(churchEventRegistrations)
        .where(eq(churchEventRegistrations.tenantId, context.tenantId));

      const [donationRow] = await tx
        .select({
          donationCount: sql<number>`count(*)::int`,
          totalRaisedMinor: sql<number>`coalesce(sum(${churchDonations.amountMinor}), 0)::bigint`,
        })
        .from(churchDonations)
        .where(eq(churchDonations.tenantId, context.tenantId));

      const [prayerRow] = await tx
        .select({ pendingPrayers: sql<number>`count(*)::int` })
        .from(churchPrayerRequests)
        .where(
          and(
            eq(churchPrayerRequests.tenantId, context.tenantId),
            eq(churchPrayerRequests.status, "received")
          )
        );

      const [msgRow] = await tx
        .select({ newMessages: sql<number>`count(*)::int` })
        .from(churchContactMessages)
        .where(
          and(
            eq(churchContactMessages.tenantId, context.tenantId),
            eq(churchContactMessages.status, "new")
          )
        );

      return reply.send({
        sermonCount: sermonRow?.sermonCount ?? 0,
        eventCount: eventRow?.eventCount ?? 0,
        registrationCount: regRow?.registrationCount ?? 0,
        donationCount: donationRow?.donationCount ?? 0,
        totalRaisedMinor: donationRow?.totalRaisedMinor ?? 0,
        pendingPrayers: prayerRow?.pendingPrayers ?? 0,
        newMessages: msgRow?.newMessages ?? 0,
      });
    });
  });

  // GET /v1/admin/church/sermons
  app.get("/admin/church/sermons", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const items = await tx
        .select()
        .from(sermons)
        .where(eq(sermons.tenantId, context.tenantId))
        .orderBy(desc(sermons.createdAt));

      return reply.send({ items });
    });
  });

  // POST /v1/admin/church/sermons
  app.post("/admin/church/sermons", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = sermonInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [newSermon] = await tx
        .insert(sermons)
        .values({
          tenantId: context.tenantId,
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description,
          speaker: parsed.data.speaker,
          youtubeVideoId: parsed.data.youtubeVideoId,
          thumbnailUrl: parsed.data.thumbnailUrl,
          scriptureReference: parsed.data.scriptureReference,
          publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : new Date(),
          status: parsed.data.status ?? "published",
        })
        .returning();

      return reply.code(201).send({ sermon: newSermon });
    });
  });

  // DELETE /v1/admin/church/sermons/:id
  app.delete<{ Params: { id: string } }>("/admin/church/sermons/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      await tx
        .delete(sermons)
        .where(and(eq(sermons.tenantId, context.tenantId), eq(sermons.id, request.params.id)));

      return reply.send({ success: true });
    });
  });

  // GET /v1/admin/church/events
  app.get("/admin/church/events", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const items = await tx
        .select()
        .from(churchEvents)
        .where(eq(churchEvents.tenantId, context.tenantId))
        .orderBy(desc(churchEvents.startsAt));

      return reply.send({ events: items });
    });
  });

  // POST /v1/admin/church/events
  app.post("/admin/church/events", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const parsed = eventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    }

    return withTenantTransaction(context.tenantId, async (tx) => {
      const [newEvent] = await tx
        .insert(churchEvents)
        .values({
          tenantId: context.tenantId,
          title: parsed.data.title,
          slug: parsed.data.slug,
          description: parsed.data.description,
          venue: parsed.data.venue,
          address: parsed.data.address,
          startsAt: new Date(parsed.data.startsAt),
          endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
          registrationCapacity: parsed.data.registrationCapacity,
          registrationEnabled: parsed.data.registrationEnabled ?? true,
          status: parsed.data.status ?? "upcoming",
        })
        .returning();

      return reply.code(201).send({ event: newEvent });
    });
  });

  // DELETE /v1/admin/church/events/:id
  app.delete<{ Params: { id: string } }>("/admin/church/events/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      await tx
        .delete(churchEvents)
        .where(and(eq(churchEvents.tenantId, context.tenantId), eq(churchEvents.id, request.params.id)));

      return reply.send({ success: true });
    });
  });

  // GET /v1/admin/church/registrations
  app.get("/admin/church/registrations", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx
        .select({
          id: churchEventRegistrations.id,
          fullName: churchEventRegistrations.fullName,
          email: churchEventRegistrations.email,
          telephone: churchEventRegistrations.telephone,
          registrationReference: churchEventRegistrations.registrationReference,
          status: churchEventRegistrations.status,
          createdAt: churchEventRegistrations.createdAt,
          eventTitle: churchEvents.title,
        })
        .from(churchEventRegistrations)
        .innerJoin(churchEvents, eq(churchEventRegistrations.eventId, churchEvents.id))
        .where(eq(churchEventRegistrations.tenantId, context.tenantId))
        .orderBy(desc(churchEventRegistrations.createdAt));

      return reply.send({ registrations: rows });
    });
  });

  // GET /v1/admin/church/donations
  app.get("/admin/church/donations", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(churchDonations)
        .where(eq(churchDonations.tenantId, context.tenantId))
        .orderBy(desc(churchDonations.createdAt));

      return reply.send({ donations: rows });
    });
  });

  // GET /v1/admin/church/prayers
  app.get("/admin/church/prayers", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(churchPrayerRequests)
        .where(eq(churchPrayerRequests.tenantId, context.tenantId))
        .orderBy(desc(churchPrayerRequests.createdAt));

      return reply.send({ prayers: rows });
    });
  });

  // PATCH /v1/admin/church/prayers/:id/status
  app.patch<{ Params: { id: string }; Body: { status: "received" | "prayed_for" } }>(
    "/admin/church/prayers/:id/status",
    async (request, reply) => {
      const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
      await assertChurchEnabled(context.tenantId);

      const status = request.body?.status;
      if (!status || !["received", "prayed_for"].includes(status)) {
        return reply.code(400).send({ error: "INVALID_STATUS", message: "Valid status is required." });
      }

      return withTenantTransaction(context.tenantId, async (tx) => {
        await tx
          .update(churchPrayerRequests)
          .set({ status })
          .where(
            and(
              eq(churchPrayerRequests.tenantId, context.tenantId),
              eq(churchPrayerRequests.id, request.params.id)
            )
          );

        return reply.send({ success: true });
      });
    }
  );

  // GET /v1/admin/church/messages
  app.get("/admin/church/messages", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);

    return withTenantTransaction(context.tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(churchContactMessages)
        .where(eq(churchContactMessages.tenantId, context.tenantId))
        .orderBy(desc(churchContactMessages.createdAt));

      return reply.send({ messages: rows });
    });
  });

  // PATCH /v1/admin/church/messages/:id/status
  app.patch<{ Params: { id: string }; Body: { status: "new" | "reviewed" | "archived" } }>(
    "/admin/church/messages/:id/status",
    async (request, reply) => {
      const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
      await assertChurchEnabled(context.tenantId);

      const status = request.body?.status;
      if (!status || !["new", "reviewed", "archived"].includes(status)) {
        return reply.code(400).send({ error: "INVALID_STATUS", message: "Valid status is required." });
      }

      return withTenantTransaction(context.tenantId, async (tx) => {
        await tx
          .update(churchContactMessages)
          .set({ status })
          .where(
            and(
              eq(churchContactMessages.tenantId, context.tenantId),
              eq(churchContactMessages.id, request.params.id)
            )
          );

        return reply.send({ success: true });
      });
    }
  );
}
