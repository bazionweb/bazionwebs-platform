import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { and, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import {
  churchPublicSiteSettingsSchema,
  contactMessageSchema,
  donationInitiateSchema,
  donationCampaignInputSchema,
  eventInputSchema,
  eventRegistrationSchema,
  newsletterSubscribeSchema,
  prayerRequestSchema,
  sermonInputSchema,
  type ChurchSiteSettingsInput,
} from "@bazion/church-ministry-contracts";
import { getMinistrySiteSettings, saveMinistrySiteSettings, slugifyContentTitle, uniqueTenantSlug } from "@bazion/church-ministry-domain";
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
  tenants,
  sermonCategories,
  sermons,
} from "@bazion/database";
import { requireActiveTenantPermission } from "@bazion/auth";
import type { AppConfig } from "../../config.js";
import { withTenantTransaction, type TenantTransaction } from "../../lib/database.js";
import { resolveTenantId } from "../../lib/tenant-resolution.js";
import { isTenantModuleEnabled } from "../../lib/tenant-modules.js";
import { DarajaClient, normalizeKenyanPhoneNumber } from "@bazion/payments";
import {
  buildTenantObjectKey,
  createObjectStorage,
  detectImageContentType,
  imageExtensionForContentType,
  sanitizeImageFilename,
  type ObjectStorage,
} from "@bazion/storage";

interface RouteOptions {
  config: AppConfig;
  storage?: ObjectStorage;
}

const MEDIA_UPLOAD_LIMIT_BYTES = 8 * 1024 * 1024;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isUniqueConstraintViolation(error: unknown, depth = 0): boolean {
  if (depth > 4) return false;
  const record = objectValue(error);
  if (!record) return false;
  return record.code === "23505" || isUniqueConstraintViolation(record.cause, depth + 1);
}

function parseStoredSiteSettings(value: string | null | undefined) {
  if (!value) return churchPublicSiteSettingsSchema.parse({});
  try {
    const parsed = churchPublicSiteSettingsSchema.safeParse(JSON.parse(value) as unknown);
    return parsed.success ? parsed.data : churchPublicSiteSettingsSchema.parse({});
  } catch {
    return churchPublicSiteSettingsSchema.parse({});
  }
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
  const daraja = config.mpesa ? new DarajaClient(config.mpesa) : null;
  const mediaStorageConfig = config.mediaStorage ?? { driver: "local" as const };
  const storage = options.storage ?? createObjectStorage({
    driver: mediaStorageConfig.driver,
    ...(mediaStorageConfig.localDirectory ? { localDirectory: mediaStorageConfig.localDirectory } : {}),
    ...(mediaStorageConfig.s3 ? { s3: mediaStorageConfig.s3 } : {}),
  });

  const ministrySiteSettingsRepository = {
    load: (tenantId: string) => withTenantTransaction(tenantId, async (tx) => {
      const [tenant] = await tx.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
      const [profile] = await tx.select().from(ministryProfiles).where(eq(ministryProfiles.tenantId, tenantId)).limit(1);
      const leaders = await tx.select().from(leadershipProfiles)
        .where(and(eq(leadershipProfiles.tenantId, tenantId), eq(leadershipProfiles.status, "active")))
        .orderBy(leadershipProfiles.displayOrder);
      const [storedSettings] = await tx.select({ settingValue: ministrySettings.settingValue }).from(ministrySettings)
        .where(and(eq(ministrySettings.tenantId, tenantId), eq(ministrySettings.settingKey, "public_site"))).limit(1);
      return {
        tenantName: tenant?.name ?? null,
        profile: profile ?? null,
        storedSettings: storedSettings?.settingValue ?? null,
        leaders: leaders.map(({ name, position, biography, photoUrl }) => ({ name, position, biography, photoUrl })),
      };
    }),
    save: (tenantId: string, input: ChurchSiteSettingsInput, updatedAt: Date) =>
      withTenantTransaction(tenantId, async (tx) => {
        const { profile, settings } = input;
        await tx.insert(ministryProfiles).values({
          tenantId,
          ministryName: profile.ministryName,
          logoAssetUrl: profile.logoUrl || null,
          description: profile.tagline,
          vision: profile.vision,
          mission: profile.mission,
          outreach: profile.outreach,
          address: profile.contact.address,
          email: profile.contact.email || null,
          telephoneNumbers: profile.contact.phones,
          socialLinks: profile.social,
          updatedAt,
        }).onConflictDoUpdate({
          target: ministryProfiles.tenantId,
          set: {
            ministryName: profile.ministryName,
            logoAssetUrl: profile.logoUrl || null,
            description: profile.tagline,
            vision: profile.vision,
            mission: profile.mission,
            outreach: profile.outreach,
            address: profile.contact.address,
            email: profile.contact.email || null,
            telephoneNumbers: profile.contact.phones,
            socialLinks: profile.social,
            updatedAt,
          },
        });

        const settingValue = JSON.stringify(settings);
        await tx.insert(ministrySettings).values({ tenantId, settingKey: "public_site", settingValue, updatedAt })
          .onConflictDoUpdate({
            target: [ministrySettings.tenantId, ministrySettings.settingKey],
            set: { settingValue, updatedAt },
          });
      }),
  };

  const tenantForRequest = (request: FastifyRequest) => {
    const explicit = request.headers["x-bazion-tenant"] as string | undefined;
    return resolveTenantId(request.hostname, config, explicit);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC CHURCH ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  // Local development media is served through the same tenant host and public API rewrite.
  // In production, image URLs point to the configured public storage/CDN domain.
  app.get<{ Params: { "*": string } }>("/public/church/media/*", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    const key = request.params["*"];
    if (!key.startsWith(`${tenantId}/`)) return reply.code(404).send({ error: "MEDIA_NOT_FOUND" });
    const stored = await storage.getObject({ tenantId, key });
    if (!stored) return reply.code(404).send({ error: "MEDIA_NOT_FOUND" });
    return reply
      .header("Content-Type", stored.contentType)
      .header("Content-Length", String(stored.sizeBytes))
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(stored.body);
  });

  // GET /v1/public/church/site
  app.get("/public/church/site", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const [tenant] = await tx
        .select({ slug: tenants.slug, name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
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

      const [storedSiteSettings] = await tx
        .select({ settingValue: ministrySettings.settingValue })
        .from(ministrySettings)
        .where(and(eq(ministrySettings.tenantId, tenantId), eq(ministrySettings.settingKey, "public_site")))
        .limit(1);
      const siteSettings = storedSiteSettings?.settingValue
        ? parseStoredSiteSettings(storedSiteSettings.settingValue)
        : null;

      return reply.send({
        tenant: tenant ?? null,
        profile: profile ?? null,
        leaders,
        siteSettings,
      });
    });
  });

  // GET /v1/public/church/sermons
  app.get<{
      Querystring: { search?: string; category?: string; limit?: string; offset?: string };
  }>("/public/church/sermons", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
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
      if (request.query.category?.trim()) {
        conditions = and(conditions, ilike(sermonCategories.name, request.query.category.trim()))!;
      }

      const items = await tx
        .select({ ...getTableColumns(sermons), category: sermonCategories.name })
        .from(sermons)
        .leftJoin(sermonCategories, and(
          eq(sermonCategories.id, sermons.categoryId),
          eq(sermonCategories.tenantId, tenantId),
        ))
        .where(conditions)
        .orderBy(desc(sermons.publishedAt), desc(sermons.createdAt))
        .limit(limit)
        .offset(offset);

      const countRows = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(sermons)
        .leftJoin(sermonCategories, and(
          eq(sermonCategories.id, sermons.categoryId),
          eq(sermonCategories.tenantId, tenantId),
        ))
        .where(conditions);

      const total = countRows[0]?.total ?? 0;
      return reply.send({ items, total, limit, offset });
    });
  });

  // GET /v1/public/church/sermons/:slug
  app.get<{ Params: { slug: string } }>("/public/church/sermons/:slug", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
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
      const tenantId = await tenantForRequest(request);
      await assertChurchEnabled(tenantId);

      const limit = Math.min(Math.max(Number.parseInt(request.query.limit ?? "20", 10) || 20, 1), 50);
      const filter = request.query.filter ?? "all";

      return withTenantTransaction(tenantId, async (tx) => {
        const conditions = [eq(churchEvents.tenantId, tenantId), sql`${churchEvents.status} <> 'cancelled'`];
        const now = new Date();

        if (filter === "upcoming") {
          conditions.push(and(eq(churchEvents.status, "upcoming"), sql`${churchEvents.startsAt} >= ${now}`)!);
        } else if (filter === "past") {
          conditions.push(or(eq(churchEvents.status, "completed"), sql`${churchEvents.startsAt} < ${now}`)!);
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
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const [event] = await tx
        .select()
        .from(churchEvents)
        .where(and(
          eq(churchEvents.tenantId, tenantId),
          eq(churchEvents.slug, request.params.slug),
          sql`${churchEvents.status} <> 'cancelled'`,
        ))
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
      const tenantId = await tenantForRequest(request);
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
          .for("update")
          .limit(1);

        if (!event) {
          return reply.code(404).send({ error: "EVENT_NOT_FOUND", message: "Event not found." });
        }

        if (!event.registrationEnabled || event.status !== "upcoming" || event.startsAt <= new Date()) {
          return reply
            .code(409)
            .send({ error: "REGISTRATION_CLOSED", message: "Registration is closed for this event." });
        }

        if (event.registrationCapacity !== null) {
          const [registrationCount] = await tx
            .select({ total: sql<number>`count(*)::int` })
            .from(churchEventRegistrations)
            .where(and(
              eq(churchEventRegistrations.tenantId, tenantId),
              eq(churchEventRegistrations.eventId, event.id),
              eq(churchEventRegistrations.status, "confirmed"),
            ));
          if ((registrationCount?.total ?? 0) >= event.registrationCapacity) {
            return reply.code(409).send({ error: "EVENT_FULL", message: "Registration capacity has been reached." });
          }
        }

        const refCode = `REG-${randomBytes(8).toString("hex").toUpperCase()}`;

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
            consentAt: new Date(),
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
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);

    return withTenantTransaction(tenantId, async (tx) => {
      const items = await tx
        .select()
        .from(donationCampaigns)
        .where(and(
          eq(donationCampaigns.tenantId, tenantId),
          eq(donationCampaigns.status, "active"),
          or(sql`${donationCampaigns.startsAt} is null`, sql`${donationCampaigns.startsAt} <= now()`),
          or(sql`${donationCampaigns.endsAt} is null`, sql`${donationCampaigns.endsAt} > now()`),
        ))
        .orderBy(desc(donationCampaigns.createdAt));

      return reply.send({ campaigns: items });
    });
  });

  // POST /v1/public/church/donations/mpesa-stk
  app.post("/public/church/donations/mpesa-stk", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);
    if (!daraja) {
      return reply.code(503).send({ error: "PAYMENT_PROVIDER_UNAVAILABLE", message: "Online M-Pesa giving is not configured. Use the displayed Paybill instructions instead." });
    }

    const parsed = donationInitiateSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });
    const idempotencyKey = request.headers["idempotency-key"];
    const statusToken = request.headers["x-donation-status-token"];
    if (typeof idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,160}$/.test(idempotencyKey) ||
        typeof statusToken !== "string" || !/^[A-Za-z0-9_-]{32,160}$/.test(statusToken)) {
      return reply.code(400).send({ error: "INVALID_PAYMENT_REFERENCE", message: "A valid payment idempotency key and status token are required." });
    }

    let phoneNumber: string;
    try {
      phoneNumber = normalizeKenyanPhoneNumber(parsed.data.phoneNumber);
    } catch (error) {
      return reply.code(400).send({ error: "INVALID_PHONE_NUMBER", message: error instanceof Error ? error.message : "Enter a valid Kenyan mobile number." });
    }

    const amountMinor = parsed.data.amount * 100;
    const callbackToken = randomBytes(32).toString("base64url");
    const callbackTokenHash = sha256(callbackToken);
    const statusTokenHash = sha256(statusToken);
    const persisted = await withTenantTransaction(tenantId, async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`donation-init:${tenantId}:${idempotencyKey}`}, 0))`);
      const [existing] = await tx
        .select({ donationId: churchPaymentTransactions.donationId, transactionStatus: churchPaymentTransactions.transactionStatus, statusTokenHash: churchPaymentTransactions.statusTokenHash })
        .from(churchPaymentTransactions)
        .where(and(eq(churchPaymentTransactions.tenantId, tenantId), eq(churchPaymentTransactions.idempotencyKey, idempotencyKey)))
        .limit(1);
      if (existing) return { ...existing, created: false };

      if (parsed.data.campaignId) {
        const [campaign] = await tx.select({ id: donationCampaigns.id }).from(donationCampaigns).where(and(
          eq(donationCampaigns.tenantId, tenantId),
          eq(donationCampaigns.id, parsed.data.campaignId),
          eq(donationCampaigns.status, "active"),
          or(sql`${donationCampaigns.startsAt} is null`, sql`${donationCampaigns.startsAt} <= now()`),
          or(sql`${donationCampaigns.endsAt} is null`, sql`${donationCampaigns.endsAt} > now()`),
        )).for("update").limit(1);
        if (!campaign) throw Object.assign(new Error("This giving campaign is no longer active."), { statusCode: 400, code: "CAMPAIGN_NOT_ACTIVE" });
      }

      const [donation] = await tx.insert(churchDonations).values({
        tenantId,
        campaignId: parsed.data.campaignId,
        donorName: parsed.data.anonymous ? null : parsed.data.donorName ?? null,
        donorEmail: parsed.data.anonymous ? null : parsed.data.donorEmail ?? null,
        donorPhone: `+${phoneNumber}`,
        amountMinor,
        currency: "KES",
        givingCategory: parsed.data.givingCategory,
        paymentMethod: "M-Pesa",
        paymentStatus: "pending",
        anonymous: parsed.data.anonymous,
        consentAt: new Date(),
      }).returning({ id: churchDonations.id });
      if (!donation) throw Object.assign(new Error("Could not create the donation record."), { statusCode: 500 });

      await tx.insert(churchPaymentTransactions).values({
        tenantId,
        donationId: donation.id,
        provider: "mpesa-daraja",
        amountMinor,
        currency: "KES",
        transactionStatus: "pending",
        callbackTokenHash,
        statusTokenHash,
        idempotencyKey,
      });
      return { donationId: donation.id, transactionStatus: "pending", statusTokenHash, created: true };
    });

    if (persisted.statusTokenHash !== statusTokenHash) {
      return reply.code(409).send({ error: "IDEMPOTENCY_KEY_REUSED", message: "This payment key belongs to another attempt." });
    }
    if (!persisted.created) {
      return reply.code(200).send({ success: true, donationId: persisted.donationId, status: persisted.transactionStatus, reused: true });
    }

    const callbackUrl = new URL(config.mpesa!.callbackUrl);
    callbackUrl.pathname = "/v1/public/church/donations/mpesa-callback";
    callbackUrl.search = "";
    callbackUrl.hash = "";
    callbackUrl.searchParams.set("tenantId", tenantId);
    callbackUrl.searchParams.set("token", callbackToken);
    try {
      const providerResult = await daraja.initiateStkPush({
        amountKes: parsed.data.amount,
        phoneNumber,
        accountReference: persisted.donationId.replace(/-/g, "").slice(0, 12),
        transactionDescription: parsed.data.givingCategory,
        callbackUrl: callbackUrl.toString(),
      });
      await withTenantTransaction(tenantId, async (tx) => {
        await tx.update(churchPaymentTransactions).set({
          checkoutRequestId: providerResult.checkoutRequestId,
          merchantRequestId: providerResult.merchantRequestId,
        }).where(and(
          eq(churchPaymentTransactions.tenantId, tenantId),
          eq(churchPaymentTransactions.donationId, persisted.donationId),
          eq(churchPaymentTransactions.idempotencyKey, idempotencyKey),
        ));
      });
      return reply.code(202).send({
        success: true,
        donationId: persisted.donationId,
        status: "pending",
        message: "Safaricom accepted the payment request. Approve it on your phone; the donation is not confirmed until the callback arrives.",
      });
    } catch (error) {
      if (error && typeof error === "object" && "deliveryState" in error && error.deliveryState === "not_sent") {
        await withTenantTransaction(tenantId, async (tx) => {
          await tx.update(churchPaymentTransactions).set({ transactionStatus: "failed", callbackTokenHash: null })
            .where(and(eq(churchPaymentTransactions.tenantId, tenantId), eq(churchPaymentTransactions.donationId, persisted.donationId)));
          await tx.update(churchDonations).set({ paymentStatus: "failed" })
            .where(and(eq(churchDonations.tenantId, tenantId), eq(churchDonations.id, persisted.donationId)));
        });
        return reply.code(502).send({ error: "PAYMENT_REQUEST_REJECTED", message: error instanceof Error ? error.message : "Safaricom rejected the payment request." });
      }
      return reply.code(202).send({
        success: true,
        donationId: persisted.donationId,
        status: "pending",
        message: "The provider response is delayed. Check your phone and use the payment status check before trying again.",
      });
    }
  });

  // Provider callback. The per-attempt capability token is stored only as a hash.
  app.post<{ Querystring: { tenantId?: string; token?: string } }>("/public/church/donations/mpesa-callback", async (request, reply) => {
    const tenantId = request.query.tenantId ?? "";
    const token = request.query.token ?? "";
    if (!isUuid(tenantId) || !/^[A-Za-z0-9_-]{40,64}$/.test(token)) return reply.code(404).send({ error: "CALLBACK_NOT_FOUND" });
    const body = objectValue(request.body);
    const stkCallback = objectValue(objectValue(body?.Body)?.stkCallback);
    const checkoutRequestId = stkCallback?.CheckoutRequestID;
    const merchantRequestId = stkCallback?.MerchantRequestID;
    const rawResultCode = stkCallback?.ResultCode;
    const resultCode = typeof rawResultCode === "number" ? rawResultCode
      : typeof rawResultCode === "string" && /^-?\d+$/.test(rawResultCode) ? Number(rawResultCode) : Number.NaN;
    if (typeof checkoutRequestId !== "string" || typeof merchantRequestId !== "string" || !Number.isInteger(resultCode)) {
      return reply.code(400).send({ error: "INVALID_PAYMENT_CALLBACK" });
    }
    const items = objectValue(stkCallback?.CallbackMetadata)?.Item;
    const metadata = new Map<string, unknown>();
    if (Array.isArray(items)) {
      for (const item of items) {
        const entry = objectValue(item);
        if (typeof entry?.Name === "string") metadata.set(entry.Name, entry.Value);
      }
    }

    return withTenantTransaction(tenantId, async (tx) => {
      const [payment] = await tx.select({
        donationId: churchPaymentTransactions.donationId,
        campaignId: churchDonations.campaignId,
        transactionStatus: churchPaymentTransactions.transactionStatus,
        checkoutRequestId: churchPaymentTransactions.checkoutRequestId,
        merchantRequestId: churchPaymentTransactions.merchantRequestId,
        amountMinor: churchPaymentTransactions.amountMinor,
        donorPhone: churchDonations.donorPhone,
      }).from(churchPaymentTransactions)
        .innerJoin(churchDonations, and(
          eq(churchDonations.id, churchPaymentTransactions.donationId),
          eq(churchDonations.tenantId, churchPaymentTransactions.tenantId),
        ))
        .where(and(
          eq(churchPaymentTransactions.tenantId, tenantId),
          eq(churchPaymentTransactions.callbackTokenHash, sha256(token)),
        ))
        .for("update")
        .limit(1);
      if (!payment) return reply.code(404).send({ error: "CALLBACK_NOT_FOUND" });
      if ((payment.checkoutRequestId && payment.checkoutRequestId !== checkoutRequestId) ||
          (payment.merchantRequestId && payment.merchantRequestId !== merchantRequestId)) {
        return reply.code(409).send({ error: "CALLBACK_REFERENCE_MISMATCH" });
      }
      if (payment.transactionStatus !== "pending") return reply.send({ ResultCode: 0, ResultDesc: "Already processed" });

      if (resultCode === 0) {
        const amountMinor = Math.round(Number(metadata.get("Amount")) * 100);
        const callbackPhone = metadata.get("PhoneNumber");
        const receipt = metadata.get("MpesaReceiptNumber");
        let normalizedCallbackPhone = "";
        try { normalizedCallbackPhone = normalizeKenyanPhoneNumber(String(callbackPhone ?? "")); } catch { /* checked below */ }
        const expectedPhone = payment.donorPhone ? normalizeKenyanPhoneNumber(payment.donorPhone) : "";
        if (!Number.isSafeInteger(amountMinor) || amountMinor !== payment.amountMinor ||
            normalizedCallbackPhone !== expectedPhone || typeof receipt !== "string" || !receipt.trim()) {
          return reply.code(400).send({ error: "PAYMENT_CALLBACK_VALIDATION_FAILED" });
        }
        await tx.update(churchPaymentTransactions).set({
          transactionStatus: "succeeded",
          providerReference: receipt.trim().slice(0, 160),
          verifiedAt: new Date(),
          checkoutRequestId,
          merchantRequestId,
          rawCallbackJson: { resultCode, amountMinor, receipt: receipt.trim().slice(0, 160) },
        }).where(and(eq(churchPaymentTransactions.tenantId, tenantId), eq(churchPaymentTransactions.donationId, payment.donationId)));
        await tx.update(churchDonations).set({ paymentStatus: "verified" })
          .where(and(eq(churchDonations.tenantId, tenantId), eq(churchDonations.id, payment.donationId)));
        if (payment.campaignId) {
          await tx.update(donationCampaigns).set({
            raisedAmountMinor: sql`${donationCampaigns.raisedAmountMinor} + ${payment.amountMinor}`,
            updatedAt: new Date(),
          }).where(and(eq(donationCampaigns.tenantId, tenantId), eq(donationCampaigns.id, payment.campaignId)));
        }
      } else {
        await tx.update(churchPaymentTransactions).set({
          transactionStatus: "failed",
          checkoutRequestId,
          merchantRequestId,
          rawCallbackJson: { resultCode },
        }).where(and(eq(churchPaymentTransactions.tenantId, tenantId), eq(churchPaymentTransactions.donationId, payment.donationId)));
        await tx.update(churchDonations).set({ paymentStatus: "failed" })
          .where(and(eq(churchDonations.tenantId, tenantId), eq(churchDonations.id, payment.donationId)));
      }
      return reply.send({ ResultCode: 0, ResultDesc: "Accepted" });
    });
  });

  // Status lookup uses a client-held capability token and returns no donor data.
  app.get("/public/church/donations/status", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
    await assertChurchEnabled(tenantId);
    const token = request.headers["x-donation-status-token"];
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,160}$/.test(token)) return reply.code(400).send({ error: "INVALID_STATUS_TOKEN" });
    const [payment] = await withTenantTransaction(tenantId, (tx) => tx.select({
      donationId: churchPaymentTransactions.donationId,
      status: churchPaymentTransactions.transactionStatus,
      paymentStatus: churchDonations.paymentStatus,
      providerReference: churchPaymentTransactions.providerReference,
    }).from(churchPaymentTransactions)
      .innerJoin(churchDonations, and(
        eq(churchDonations.id, churchPaymentTransactions.donationId),
        eq(churchDonations.tenantId, churchPaymentTransactions.tenantId),
      ))
      .where(and(
        eq(churchPaymentTransactions.tenantId, tenantId),
        eq(churchPaymentTransactions.statusTokenHash, sha256(token)),
      ))
      .limit(1));
    if (!payment) return reply.code(404).send({ error: "PAYMENT_STATUS_NOT_FOUND" });
    return reply.send({ donationId: payment.donationId, status: payment.status, paymentStatus: payment.paymentStatus, providerReference: payment.providerReference });
  });

  // POST /v1/public/church/contact
  app.post("/public/church/contact", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
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
        consentAt: new Date(),
      });

      return reply.code(201).send({
        success: true,
        message: "Thank you for reaching out. The ministry secretariat has received your enquiry.",
      });
    });
  });

  // POST /v1/public/church/prayer-requests
  app.post("/public/church/prayer-requests", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
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
        consentAt: new Date(),
      });

      return reply.code(201).send({
        success: true,
        message: "Your prayer request has been received. Our intercessory team is lifting you up in prayer.",
      });
    });
  });

  // POST /v1/public/church/newsletter
  app.post("/public/church/newsletter", async (request, reply) => {
    const tenantId = await tenantForRequest(request);
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
        message: "Your email preference has been saved for ministry updates.",
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // PROTECTED CHURCH ADMIN ROUTES
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /v1/admin/church/media
  app.get("/admin/church/media", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);
    const items = await storage.listObjects({ tenantId: context.tenantId, limit: 100 });
    return reply.send({ items });
  });

  // POST /v1/admin/church/media
  app.post<{ Querystring: { filename?: string; contentType?: string } }>("/admin/church/media", { bodyLimit: MEDIA_UPLOAD_LIMIT_BYTES }, async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const bytes = request.body;
    if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0) {
      return reply.code(400).send({ error: "MEDIA_EMPTY", message: "Choose an image file to upload." });
    }
    if (bytes.byteLength > MEDIA_UPLOAD_LIMIT_BYTES) {
      return reply.code(413).send({ error: "MEDIA_TOO_LARGE", message: "Images must be 8 MB or smaller." });
    }
    const declaredType = request.query.contentType?.trim().toLowerCase() ?? "";
    const actualType = detectImageContentType(bytes);
    const extension = actualType ? imageExtensionForContentType(actualType) : undefined;
    if (!actualType || actualType !== declaredType || !extension) {
      return reply.code(415).send({ error: "UNSUPPORTED_MEDIA_TYPE", message: "Upload a valid JPEG, PNG, WebP, or AVIF image." });
    }

    const filename = sanitizeImageFilename(request.query.filename, extension);
    const key = buildTenantObjectKey(context.tenantId, randomBytes(16).toString("hex"), filename);
    await storage.putObject({ tenantId: context.tenantId, key, body: bytes, contentType: actualType });
    return reply.code(201).send({
      asset: {
        key,
        url: storage.publicUrl(key),
        contentType: actualType,
        sizeBytes: bytes.byteLength,
        lastModified: new Date().toISOString(),
      },
    });
  });

  // GET /v1/admin/church/site-settings
  app.get("/admin/church/site-settings", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);
    return reply.send(await getMinistrySiteSettings(ministrySiteSettingsRepository, context.tenantId));
  });

  // PUT /v1/admin/church/site-settings
  app.put("/admin/church/site-settings", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);

    const result = await saveMinistrySiteSettings(ministrySiteSettingsRepository, context.tenantId, request.body);
    if (!result.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: result.issues });
    return reply.send(result);
  });

  // GET /v1/admin/church/campaigns
  app.get("/admin/church/campaigns", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["read"] });
    await assertChurchEnabled(context.tenantId);
    return withTenantTransaction(context.tenantId, async (tx) => {
      const campaigns = await tx.select().from(donationCampaigns)
        .where(eq(donationCampaigns.tenantId, context.tenantId))
        .orderBy(desc(donationCampaigns.createdAt));
      return reply.send({ campaigns });
    });
  });

  // POST /v1/admin/church/campaigns
  app.post("/admin/church/campaigns", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const parsed = donationCampaignInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "VALIDATION_ERROR", details: parsed.error.issues });

    try {
      return await withTenantTransaction(context.tenantId, async (tx) => {
        const slug = await uniqueTenantSlug(parsed.data.slug ?? slugifyContentTitle(parsed.data.title, "campaign"), 120, async (candidate) => {
          const [existing] = await tx.select({ id: donationCampaigns.id }).from(donationCampaigns)
            .where(and(eq(donationCampaigns.tenantId, context.tenantId), eq(donationCampaigns.slug, candidate))).limit(1);
          return Boolean(existing);
        });
        const [campaign] = await tx.insert(donationCampaigns).values({
          tenantId: context.tenantId,
          title: parsed.data.title,
          slug,
          description: parsed.data.description,
          targetAmountMinor: parsed.data.targetAmountKsh * 100,
          currency: "KES",
          startsAt: parsed.data.startsAt ? new Date(parsed.data.startsAt) : null,
          endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
          status: parsed.data.status,
        }).returning();
        return reply.code(201).send({ campaign });
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return reply.code(409).send({ error: "CAMPAIGN_SLUG_EXISTS", message: "A campaign with this URL slug already exists. Choose another slug." });
      throw error;
    }
  });

  // PATCH /v1/admin/church/campaigns/:id/status
  app.patch<{ Params: { id: string }; Body: { status: "active" | "paused" | "completed" } }>("/admin/church/campaigns/:id/status", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const status = request.body?.status;
    if (!status || !["active", "paused", "completed"].includes(status)) {
      return reply.code(400).send({ error: "INVALID_STATUS", message: "Choose active, paused, or completed." });
    }
    const [updated] = await withTenantTransaction(context.tenantId, (tx) => tx.update(donationCampaigns)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(donationCampaigns.tenantId, context.tenantId), eq(donationCampaigns.id, request.params.id)))
      .returning({ id: donationCampaigns.id }));
    if (!updated) return reply.code(404).send({ error: "CAMPAIGN_NOT_FOUND", message: "Campaign not found." });
    return reply.send({ success: true });
  });

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
        .where(and(eq(churchDonations.tenantId, context.tenantId), eq(churchDonations.paymentStatus, "verified")));

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

    try {
      return await withTenantTransaction(context.tenantId, async (tx) => {
        const slug = await uniqueTenantSlug(parsed.data.slug ?? slugifyContentTitle(parsed.data.title, "sermon"), 140, async (candidate) => {
          const [existing] = await tx.select({ id: sermons.id }).from(sermons)
            .where(and(eq(sermons.tenantId, context.tenantId), eq(sermons.slug, candidate))).limit(1);
          return Boolean(existing);
        });
        const [newSermon] = await tx
          .insert(sermons)
          .values({
            tenantId: context.tenantId,
            title: parsed.data.title,
            slug,
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
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return reply.code(409).send({ error: "SERMON_SLUG_EXISTS", message: "A sermon with this URL slug already exists. Choose another slug." });
      throw error;
    }
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

  // PATCH /v1/admin/church/sermons/:id/status
  app.patch<{ Params: { id: string }; Body: { status: "draft" | "published" | "archived" } }>("/admin/church/sermons/:id/status", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const status = request.body?.status;
    if (!status || !["draft", "published", "archived"].includes(status)) {
      return reply.code(400).send({ error: "INVALID_STATUS", message: "Choose draft, published, or archived." });
    }
    const [updated] = await withTenantTransaction(context.tenantId, (tx) => tx.update(sermons)
      .set({ status, publishedAt: status === "published" ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(sermons.tenantId, context.tenantId), eq(sermons.id, request.params.id)))
      .returning({ id: sermons.id }));
    if (!updated) return reply.code(404).send({ error: "SERMON_NOT_FOUND", message: "Sermon not found." });
    return reply.send({ success: true });
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

    try {
      return await withTenantTransaction(context.tenantId, async (tx) => {
        const slug = await uniqueTenantSlug(parsed.data.slug ?? slugifyContentTitle(parsed.data.title, "event"), 140, async (candidate) => {
          const [existing] = await tx.select({ id: churchEvents.id }).from(churchEvents)
            .where(and(eq(churchEvents.tenantId, context.tenantId), eq(churchEvents.slug, candidate))).limit(1);
          return Boolean(existing);
        });
        const [newEvent] = await tx
          .insert(churchEvents)
          .values({
            tenantId: context.tenantId,
            title: parsed.data.title,
            slug,
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
    } catch (error) {
      if (isUniqueConstraintViolation(error)) return reply.code(409).send({ error: "EVENT_SLUG_EXISTS", message: "An event with this URL slug already exists. Choose another slug." });
      throw error;
    }
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

  // PATCH /v1/admin/church/events/:id/status
  app.patch<{ Params: { id: string }; Body: { status: "upcoming" | "in_progress" | "completed" | "cancelled" } }>("/admin/church/events/:id/status", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { store: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const status = request.body?.status;
    if (!status || !["upcoming", "in_progress", "completed", "cancelled"].includes(status)) {
      return reply.code(400).send({ error: "INVALID_STATUS", message: "Choose a valid event status." });
    }
    const [updated] = await withTenantTransaction(context.tenantId, (tx) => tx.update(churchEvents)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(churchEvents.tenantId, context.tenantId), eq(churchEvents.id, request.params.id)))
      .returning({ id: churchEvents.id }));
    if (!updated) return reply.code(404).send({ error: "EVENT_NOT_FOUND", message: "Event not found." });
    return reply.send({ success: true });
  });

  // GET /v1/admin/church/registrations
  app.get("/admin/church/registrations", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
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

  // DELETE /v1/admin/church/registrations/:id allows the ministry to fulfill removal requests.
  app.delete<{ Params: { id: string } }>("/admin/church/registrations/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const [deleted] = await withTenantTransaction(context.tenantId, (tx) => tx.delete(churchEventRegistrations)
      .where(and(eq(churchEventRegistrations.tenantId, context.tenantId), eq(churchEventRegistrations.id, request.params.id)))
      .returning({ id: churchEventRegistrations.id }));
    if (!deleted) return reply.code(404).send({ error: "REGISTRATION_NOT_FOUND", message: "Registration not found." });
    return reply.send({ success: true });
  });

  // GET /v1/admin/church/donations
  app.get("/admin/church/donations", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
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
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
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
      const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
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

  // DELETE /v1/admin/church/prayers/:id allows the ministry to fulfill removal requests.
  app.delete<{ Params: { id: string } }>("/admin/church/prayers/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const [deleted] = await withTenantTransaction(context.tenantId, (tx) => tx.delete(churchPrayerRequests)
      .where(and(eq(churchPrayerRequests.tenantId, context.tenantId), eq(churchPrayerRequests.id, request.params.id)))
      .returning({ id: churchPrayerRequests.id }));
    if (!deleted) return reply.code(404).send({ error: "PRAYER_REQUEST_NOT_FOUND", message: "Prayer request not found." });
    return reply.send({ success: true });
  });

  // GET /v1/admin/church/messages
  app.get("/admin/church/messages", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
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
      const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
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

  // DELETE /v1/admin/church/messages/:id allows the ministry to fulfill removal requests.
  app.delete<{ Params: { id: string } }>("/admin/church/messages/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const [deleted] = await withTenantTransaction(context.tenantId, (tx) => tx.delete(churchContactMessages)
      .where(and(eq(churchContactMessages.tenantId, context.tenantId), eq(churchContactMessages.id, request.params.id)))
      .returning({ id: churchContactMessages.id }));
    if (!deleted) return reply.code(404).send({ error: "MESSAGE_NOT_FOUND", message: "Enquiry not found." });
    return reply.send({ success: true });
  });

  // GET /v1/admin/church/newsletter
  app.get("/admin/church/newsletter", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["read"] });
    await assertChurchEnabled(context.tenantId);
    return withTenantTransaction(context.tenantId, async (tx) => {
      const subscribers = await tx.select({ id: churchNewsletterSubscribers.id, email: churchNewsletterSubscribers.email, consentAt: churchNewsletterSubscribers.consentAt, status: churchNewsletterSubscribers.status })
        .from(churchNewsletterSubscribers)
        .where(eq(churchNewsletterSubscribers.tenantId, context.tenantId))
        .orderBy(desc(churchNewsletterSubscribers.createdAt));
      return reply.send({ subscribers });
    });
  });

  // DELETE /v1/admin/church/newsletter/:id processes an email opt-out or deletion request.
  app.delete<{ Params: { id: string } }>("/admin/church/newsletter/:id", async (request, reply) => {
    const context = await requireActiveTenantPermission(request.raw.headers, { churchprivate: ["update"] });
    await assertChurchEnabled(context.tenantId);
    const [deleted] = await withTenantTransaction(context.tenantId, (tx) => tx.delete(churchNewsletterSubscribers)
      .where(and(eq(churchNewsletterSubscribers.tenantId, context.tenantId), eq(churchNewsletterSubscribers.id, request.params.id)))
      .returning({ id: churchNewsletterSubscribers.id }));
    if (!deleted) return reply.code(404).send({ error: "NEWSLETTER_SUBSCRIBER_NOT_FOUND", message: "Subscriber not found." });
    return reply.send({ success: true });
  });
}
