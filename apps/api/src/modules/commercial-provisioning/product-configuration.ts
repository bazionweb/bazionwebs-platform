import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ProvisioningOfferBinding } from "./offer-resolution.js";
import type { ProvisioningOperationMetadata } from "./saga-orchestrator.js";

const PRODUCTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../../products");

const DEFAULT_REQUIRED_MODULES_BY_PRODUCT: Readonly<Record<string, readonly string[]>> = {
  "church-ministry": ["platform-identity", "church-ministry", "media-storage"],
  ecommerce: ["platform-identity", "commerce", "media-storage"],
  "bazion-commerce": ["platform-identity", "commerce", "media-storage"],
  "bazion-site": ["platform-identity", "website-content", "media-storage"],
  "managed-web": ["platform-identity", "website-content", "media-storage"],
};

const DEFAULT_OPTIONAL_MODULES_BY_PRODUCT: Readonly<Record<string, readonly string[]>> = {
  "church-ministry": ["notifications", "analytics", "commerce"],
  ecommerce: ["notifications", "analytics"],
  "bazion-commerce": ["notifications", "analytics"],
  "bazion-site": ["analytics", "notifications"],
  "managed-web": ["analytics", "notifications"],
};

function readManifestModuleIds(
  productId: string,
  field: "requiredModules" | "optionalModules",
): string[] | null {
  try {
    const manifestPath = resolve(PRODUCTS_DIR, `${productId}/manifest.json`);
    if (!existsSync(manifestPath)) return null;
    const raw = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    const entries = raw[field];
    if (!Array.isArray(entries)) return null;
    return entries
      .map((entry) => (entry && typeof entry === "object" ? (entry as { id?: unknown }).id : null))
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  } catch {
    return null;
  }
}

export interface ProductInitialConfigurationSpec {
  configuration: Record<string, unknown>;
  requiredModules: readonly string[];
  optionalModules: readonly string[];
  tenantPlatformSettingsDefaults: {
    locale: string;
    timeZone: string;
    defaultCurrency: "KES" | "USD" | "EUR" | "GBP";
    primaryColor: string;
  };
}

export function resolveOfferBindingForOperation(
  operation: Pick<
    ProvisioningOperationMetadata,
    | "offerId"
    | "offerVersion"
    | "productId"
    | "productVersion"
    | "solutionId"
    | "solutionVersion"
    | "templateId"
    | "templateVersion"
  >,
  offerBindings?: readonly Pick<
    ProvisioningOfferBinding,
    "offer" | "composition" | "requiredModules" | "optionalModules"
  >[],
) {
  if (!offerBindings?.length) return undefined;
  return offerBindings.find(
    (binding) =>
      binding.offer.id === operation.offerId
      && binding.offer.version === operation.offerVersion
      && binding.composition.product.id === operation.productId
      && binding.composition.product.version === operation.productVersion
      && binding.composition.solution.id === operation.solutionId
      && binding.composition.solution.version === operation.solutionVersion
      && binding.composition.template.id === operation.templateId
      && binding.composition.template.version === operation.templateVersion,
  );
}

function buildProductSpecificSettings(operation: ProvisioningOperationMetadata): Record<string, unknown> {
  if (operation.productId === "church-ministry") {
    return {
      profileMode: "church-ministry",
      siteKey: "public_site",
      templateId: operation.templateId,
      defaultNavigationSections: ["home", "visit", "ministries", "about", "sermons", "events", "contact"],
      defaultPagesEnabled: [
        "home",
        "about",
        "visit",
        "ministries",
        "sermons",
        "events",
        "gallery",
        "giving",
        "contact",
        "privacy",
        "terms",
      ],
      features: {
        sermons: true,
        events: true,
        prayerRequests: true,
        onlineGiving: true,
        mediaStorage: true,
      },
      storageQuotaMb: 2048,
    };
  }

  if (operation.productId === "ecommerce" || operation.productId === "bazion-commerce") {
    return {
      profileMode: "commerce-storefront",
      templateId: operation.templateId,
      storeDefaults: {
        defaultCountryCode: "KE",
        defaultCurrency: "KES",
        supportedCurrencies: ["KES", "USD"],
        locale: "en-KE",
        timeZone: "Africa/Nairobi",
      },
      features: {
        catalog: true,
        cart: true,
        checkout: true,
        mpesa: true,
      },
    };
  }

  if (operation.productId === "bazion-site" || operation.productId === "managed-web") {
    return {
      profileMode: "managed-website",
      templateId: operation.templateId,
      siteDefaults: {
        locale: "en-KE",
        navigationMode: "standard",
        seoEnabled: true,
      },
      features: {
        pages: true,
        formsLeads: true,
        mediaStorage: true,
      },
    };
  }

  return {
    profileMode: "standard",
    templateId: operation.templateId,
  };
}

/**
 * Derive deterministic, secret-free initial installation configuration, module entitlements,
 * and control-plane tenant settings for a provisioned product operation.
 */
export function buildProductInitialConfiguration(
  operation: ProvisioningOperationMetadata,
  binding?: Pick<ProvisioningOfferBinding, "requiredModules" | "optionalModules">,
): ProductInitialConfigurationSpec {
  const requiredModules = binding
    ? binding.requiredModules.map((mod) => mod.id)
    : readManifestModuleIds(operation.productId, "requiredModules")
      ?? [...(DEFAULT_REQUIRED_MODULES_BY_PRODUCT[operation.productId] ?? ["platform-identity", "media-storage"])];

  const optionalModules = binding
    ? binding.optionalModules.map((mod) => mod.id)
    : readManifestModuleIds(operation.productId, "optionalModules")
      ?? [...(DEFAULT_OPTIONAL_MODULES_BY_PRODUCT[operation.productId] ?? [])];

  const tenantPlatformSettingsDefaults = {
    locale: "en-KE",
    timeZone: "Africa/Nairobi",
    defaultCurrency: "KES" as const,
    primaryColor: "#236b4c",
  };

  return {
    configuration: {
      offerId: operation.offerId,
      offerVersion: operation.offerVersion,
      productId: operation.productId,
      productVersion: operation.productVersion,
      solutionId: operation.solutionId,
      solutionVersion: operation.solutionVersion,
      templateId: operation.templateId,
      templateVersion: operation.templateVersion,
      distributionMode: operation.distributionMode,
      requiredModules,
      optionalModules,
      tenantDefaults: tenantPlatformSettingsDefaults,
      productSettings: buildProductSpecificSettings(operation),
    },
    requiredModules,
    optionalModules,
    tenantPlatformSettingsDefaults,
  };
}
