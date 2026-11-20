"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { assertOk, pulse } from "@bazion/ui";

type PackageTemplateItem = {
  id: string;
  version?: string;
  name: string;
  tagline: string;
  defaultPalette: string;
  features: string[];
};

type PackageCatalogItem = {
  packageId: string;
  name: string;
  category: string;
  tagline: string;
  description: string;
  defaultPalette: string;
  assignableModules: string[];
  templates: PackageTemplateItem[];
};

type PaletteOption = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

type WhiteLabelVariable = {
  variable: string;
  category: "identity" | "theme" | "contact" | "payment" | "social";
  detectedLiteral: string;
  replacementPreview: string;
};

type ByowBlueprint = {
  deploymentMode: string;
  packageId?: string;
  framework: string;
  composePath: string;
  internalPort: number;
  healthcheckPath: string;
  composeYaml: string;
  envOverrides: Record<string, string>;
};

export type TenantWebsiteOnboardingData = {
  tenant: { id: string; slug: string; name: string; status: string };
  packages?: PackageCatalogItem[];
  palettes?: PaletteOption[];
  currentProfile: {
    ministryName: string;
    description: string | null;
    address: string | null;
    email: string | null;
    updatedAt: string | null;
  } | null;
  activePackageConfig?: {
    packageId?: string;
    templateId?: string;
    paletteId?: string;
    organization?: { name?: string; tagline?: string };
    contact?: { email?: string; address?: string };
    payment?: { mpesaPaybill?: string; accountNo?: string };
  } | null;
  templateRelease?: {
    templateId: string;
    configuredVersion: string;
    currentVersion: string;
    updateMode: "automatic" | "pinned";
  } | null;
  hasStoredSiteSettings: boolean;
  latestPublishedVersion: {
    versionNumber: number;
    publishedAt: string | null;
    note: string | null;
  } | null;
  byowBlueprint: ByowBlueprint | null;
};

const fallbackPackages: PackageCatalogItem[] = [
  {
    packageId: "sme-website",
    name: "SME & Business Website",
    category: "Commercial",
    tagline: "Multi-page business site & lead capture",
    description: "",
    defaultPalette: "corporate-slate",
    assignableModules: ["forms-leads", "media-storage", "analytics"],
    templates: [
      {
        id: "sme-corporate-authority",
        name: "Corporate & Authority Showcase",
        tagline: "Executive hero & services",
        defaultPalette: "corporate-slate",
        features: [],
      },
      {
        id: "sme-local-services",
        name: "Local Service Business & Trades",
        tagline: "High-converting local services & FAQ",
        defaultPalette: "emerald-growth",
        features: [],
      },
    ],
  },
  {
    packageId: "ecommerce",
    name: "E-Commerce Storefront",
    category: "Retail & D2C",
    tagline: "Product catalogue, cart & M-Pesa/card checkout",
    description: "",
    defaultPalette: "emerald-growth",
    assignableModules: ["commerce", "media-storage", "analytics", "notifications"],
    templates: [
      {
        id: "ecommerce-modern-retail",
        name: "Modern Online Storefront",
        tagline: "Featured collections & checkout",
        defaultPalette: "emerald-growth",
        features: [],
      },
    ],
  },
  {
    packageId: "church-ministry",
    name: "Church & Ministry Platform",
    category: "Faith & Community",
    tagline: "Sermons, events, leadership cards & giving",
    description: "",
    defaultPalette: "maroon-gold",
    assignableModules: ["church-ministry", "media-storage", "analytics"],
    templates: [
      {
        id: "gmfc-revival-signature",
        name: "GMFC Revival & Apostolic Signature",
        tagline: "Editorial church layout",
        defaultPalette: "maroon-gold",
        features: [],
      },
    ],
  },
];

const fallbackPalettes: PaletteOption[] = [
  { id: "corporate-slate", name: "Corporate Slate & Indigo", primaryColor: "#1E293B", secondaryColor: "#334155", accentColor: "#0F766E" },
  { id: "emerald-growth", name: "Emerald Commerce & Amber", primaryColor: "#065F46", secondaryColor: "#047857", accentColor: "#92400E" },
  { id: "medical-teal", name: "Clinical Teal & Cobalt", primaryColor: "#115E59", secondaryColor: "#0F766E", accentColor: "#1D4ED8" },
  { id: "maroon-gold", name: "Heritage Maroon & Gold", primaryColor: "#4A1110", secondaryColor: "#6B1A18", accentColor: "#B45E14" },
  { id: "forest-bronze", name: "Sanctuary Forest & Bronze", primaryColor: "#193A31", secondaryColor: "#315E50", accentColor: "#8B5B29" },
  { id: "royal-navy", name: "Royal Navy & Amber", primaryColor: "#0F2B48", secondaryColor: "#1E4976", accentColor: "#A16207" },
  { id: "living-waters", name: "Living Waters Teal & Ochre", primaryColor: "#0F4C5C", secondaryColor: "#136F63", accentColor: "#C25E00" },
  { id: "sanctuary-charcoal", name: "Minimal Charcoal & Burgundy", primaryColor: "#18181B", secondaryColor: "#3F3F46", accentColor: "#881337" },
];

export function TenantWebsiteOnboardingPanel({
  tenantId,
  tenantName,
  tenantStatus,
  initial,
  status,
}: {
  tenantId: string;
  tenantName: string;
  tenantStatus: "provisioning" | "active" | "suspended" | "closed";
  initial: TenantWebsiteOnboardingData | null;
  status: number;
}) {
  const router = useRouter();
  const baseUrl = `/v1/admin/platform/tenants/${encodeURIComponent(tenantId)}/website-onboarding`;
  const packages = initial?.packages?.length ? initial.packages : fallbackPackages;
  const palettes = initial?.palettes?.length ? initial.palettes : fallbackPalettes;

  const initialPackageId =
    initial?.activePackageConfig?.packageId ||
    (initial?.hasStoredSiteSettings ? "church-ministry" : packages[0]?.packageId || "sme-website");
  const initialPkg =
    packages.find((item) => item.packageId === initialPackageId) ?? packages[0]!;
  const initialTemplateId =
    initial?.activePackageConfig?.templateId || initialPkg.templates[0]?.id || "sme-corporate-authority";

  const [activeTab, setActiveTab] = useState<"template" | "byow">("template");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  // Universal white-label template state
  const [packageId, setPackageId] = useState(initialPkg.packageId);
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [paletteId, setPaletteId] = useState(
    initial?.activePackageConfig?.paletteId || initialPkg.defaultPalette,
  );
  const [brandName, setBrandName] = useState(
    initial?.activePackageConfig?.organization?.name ||
      initial?.currentProfile?.ministryName ||
      tenantName,
  );
  const [tagline, setTagline] = useState(
    initial?.activePackageConfig?.organization?.tagline ||
      initial?.currentProfile?.description ||
      initialPkg.tagline,
  );
  const [email, setEmail] = useState(
    initial?.activePackageConfig?.contact?.email || initial?.currentProfile?.email || "",
  );
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState(
    initial?.activePackageConfig?.contact?.address || initial?.currentProfile?.address || "",
  );
  const [mpesaPaybill, setMpesaPaybill] = useState(
    initial?.activePackageConfig?.payment?.mpesaPaybill || "",
  );
  const [accountNo, setAccountNo] = useState(
    initial?.activePackageConfig?.payment?.accountNo || "",
  );
  const [includeStarterContent, setIncludeStarterContent] = useState(true);

  // GitHub Repo / BYOW Importer state
  const [repoPackageMode, setRepoPackageMode] = useState<string>("auto");
  const [repoUrl, setRepoUrl] = useState("https://github.com/example/tenant-website");
  const [branch, setBranch] = useState("main");
  const [importMode, setImportMode] = useState<"whitelabel-storefront" | "byow-compose">(
    "whitelabel-storefront",
  );
  const [framework, setFramework] = useState<
    "nextjs" | "react-vite" | "astro" | "remix" | "wordpress" | "static" | "custom-docker"
  >("nextjs");
  const [primaryDomain, setPrimaryDomain] = useState("");
  const [configTs, setConfigTs] = useState("");
  const [tokensCss, setTokensCss] = useState("");
  const [applyToTenant, setApplyToTenant] = useState(true);

  const [variables, setVariables] = useState<WhiteLabelVariable[]>([]);
  const [resolvedPkgBadge, setResolvedPkgBadge] = useState<string>(
    initial?.activePackageConfig?.packageId || "",
  );
  const [blueprint, setBlueprint] = useState<ByowBlueprint | null>(initial?.byowBlueprint ?? null);

  const activePackage = packages.find((p) => p.packageId === packageId) ?? packages[0]!;

  function handlePackageChange(nextPkgId: string) {
    setPackageId(nextPkgId);
    const nextPkg = packages.find((p) => p.packageId === nextPkgId);
    if (nextPkg) {
      const firstTpl = nextPkg.templates[0];
      if (firstTpl) {
        setTemplateId(firstTpl.id);
        setPaletteId(firstTpl.defaultPalette);
      } else {
        setPaletteId(nextPkg.defaultPalette);
      }
      setTagline(nextPkg.tagline);
    }
  }

  function handleTemplateChange(nextTplId: string) {
    setTemplateId(nextTplId);
    const tpl = activePackage.templates.find((t) => t.id === nextTplId);
    if (tpl) {
      setPaletteId(tpl.defaultPalette);
    }
  }

  async function handleApplyTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || tenantStatus === "closed") return;
    setBusy(true);
    setFeedback("");

    try {
      const result = await pulse.track<{
        packageId: string;
        packageName: string;
        versionNumber?: number | null;
      }>(
        async () => {
          const response = await fetch(`${baseUrl}/apply-template`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              packageId,
              templateId,
              paletteId,
              brandName: brandName.trim() || tenantName,
              tagline: tagline.trim() || undefined,
              includeStarterContent,
              contact: {
                ...(email.trim() ? { email: email.trim() } : {}),
                ...(phone.trim().length >= 7 ? { phones: [phone.trim()] } : {}),
                ...(address.trim() ? { address: address.trim() } : {}),
              },
              payment: {
                ...(mpesaPaybill.trim() ? { mpesaPaybill: mpesaPaybill.trim() } : {}),
                ...(accountNo.trim() ? { accountNo: accountNo.trim() } : {}),
              },
            }),
          });
          await assertOk(response);
          return response.json() as Promise<{
            packageId: string;
            packageName: string;
            versionNumber?: number | null;
          }>;
        },
        {
          title: `White-labeling ${activePackage.name}`,
          pendingDetail: `Applying "${templateId}" for ${brandName || tenantName}…`,
          successTitle: (res) =>
            res.versionNumber
              ? `${res.packageName} published (v${res.versionNumber})`
              : `${res.packageName} white-labeled`,
          group: `website-template:${tenantId}`,
        },
      );
      setResolvedPkgBadge(result.packageId);
      setFeedback(
        `Applied "${templateId}" under package "${result.packageName}" cleanly${result.versionNumber ? ` (published version v${result.versionNumber})` : ""}.`,
      );
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to apply package template.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportRepo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || tenantStatus === "closed") return;
    setBusy(true);
    setFeedback("");

    try {
      const result = await pulse.track<{
        packageId: string;
        detectedFramework: string;
        whiteLabelVariables: WhiteLabelVariable[];
        byowCompose: ByowBlueprint;
        versionNumber: number | null;
      }>(
        async () => {
          const response = await fetch(`${baseUrl}/import-repo`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              repoUrl: repoUrl.trim(),
              branch: branch.trim() || "main",
              packageId: repoPackageMode,
              mode: importMode,
              framework,
              applyToTenant,
              ...(primaryDomain.trim() ? { primaryDomain: primaryDomain.trim() } : {}),
              ...(configTs.trim() ? { configTs } : {}),
              ...(tokensCss.trim() ? { tokensCss } : {}),
              brandOverrides: {
                brandName: brandName.trim() || tenantName,
                tagline: tagline.trim() || undefined,
                includeStarterContent,
                contact: {
                  ...(email.trim() ? { email: email.trim() } : {}),
                  ...(phone.trim().length >= 7 ? { phones: [phone.trim()] } : {}),
                  ...(address.trim() ? { address: address.trim() } : {}),
                },
                payment: {
                  ...(mpesaPaybill.trim() ? { mpesaPaybill: mpesaPaybill.trim() } : {}),
                  ...(accountNo.trim() ? { accountNo: accountNo.trim() } : {}),
                },
              },
            }),
          });
          await assertOk(response);
          return response.json() as Promise<{
            packageId: string;
            detectedFramework: string;
            whiteLabelVariables: WhiteLabelVariable[];
            byowCompose: ByowBlueprint;
            versionNumber: number | null;
          }>;
        },
        {
          title: "Importing & white-labeling repository",
          pendingDetail: `Scrubbing source brand literals from ${repoUrl}…`,
          successTitle: (res) => `White-labeled under ${res.packageId}`,
          group: `website-import:${tenantId}`,
        },
      );
      setVariables(result.whiteLabelVariables);
      setBlueprint(result.byowCompose);
      setResolvedPkgBadge(result.packageId);
      setFeedback(
        importMode === "whitelabel-storefront"
          ? `Resolved package "${result.packageId}", extracted ${result.whiteLabelVariables.length} brand variables, and saved white-labeled settings${result.versionNumber ? ` (v${result.versionNumber})` : ""}.`
          : `Generated dedicated BYOW Dokploy Compose blueprint for package "${result.packageId}" (${result.detectedFramework} -> ${result.byowCompose.composePath}).`,
      );
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Failed to import repository.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel website-onboarding-panel">
      <div className="website-onboarding-head">
        <div>
          <p className="eyebrow">UNIVERSAL PACKAGE WHITE-LABELING &amp; BYOW</p>
          <h2>Platform package templates &amp; custom website onboarding</h2>
          <p className="muted">
            Start from a Bazion package or bring a website repository. Set the tenant brand, then apply the setup that fits.
          </p>
        </div>
        <span className="count website-onboarding-status">
          {resolvedPkgBadge
            ? `PKG: ${resolvedPkgBadge.toUpperCase()}`
            : initial?.latestPublishedVersion
              ? `SITE v${initial.latestPublishedVersion.versionNumber}`
              : "READY"}
        </span>
      </div>

      {status !== 200 && status !== 0 && (
        <p className="notice-inline">
          Could not preload existing website onboarding state (HTTP {status}); you can still apply any package template or import a repository below.
        </p>
      )}

      <div className="website-onboarding-tabs" role="group" aria-label="Website onboarding method">
        <button
          type="button"
          aria-pressed={activeTab === "template"}
          className={`website-onboarding-tab${activeTab === "template" ? " is-active" : ""}`}
          onClick={() => setActiveTab("template")}
        >
          <span className="website-tab-step">01</span>
          <span className="website-tab-copy">
            <strong>Start from a package</strong>
            <small>Choose a ready-made site and brand it</small>
          </span>
        </button>
        <button
          type="button"
          aria-pressed={activeTab === "byow"}
          className={`website-onboarding-tab${activeTab === "byow" ? " is-active" : ""}`}
          onClick={() => setActiveTab("byow")}
        >
          <span className="website-tab-step">02</span>
          <span className="website-tab-copy">
            <strong>Bring a website repo</strong>
            <small>Import and configure a GitHub project</small>
          </span>
        </button>
      </div>

      {activeTab === "template" ? (
        <div>
          <form onSubmit={handleApplyTemplate} className="website-onboarding-form">
            <fieldset className="website-onboarding-group">
              <legend>Package &amp; visual style</legend>
              <p className="website-group-hint">Choose the starting site, page layout, and color palette.</p>
              <div className="website-field-grid website-field-grid--three">
                <label className="website-field">
                  Platform solution package
                  <select value={packageId} onChange={(e) => handlePackageChange(e.target.value)}>
                    {packages.map((item) => (
                      <option key={item.packageId} value={item.packageId}>
                        {item.name} ({item.category})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="website-field">
                  Website template
                  <select value={templateId} onChange={(e) => handleTemplateChange(e.target.value)}>
                    {activePackage.templates.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}{item.version ? ` (v${item.version})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="website-field">
                  Brand palette
                  <select value={paletteId} onChange={(e) => setPaletteId(e.target.value)}>
                    {palettes.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              {initial?.templateRelease && (
                <div className="notice-inline" role="status" style={{ marginTop: 10 }}>
                  {initial.templateRelease.updateMode === "automatic"
                    ? `Shared template v${initial.templateRelease.currentVersion} is active for this tenant. Stored baseline: v${initial.templateRelease.configuredVersion}; tenant overrides remain isolated.`
                    : `This website is pinned to v${initial.templateRelease.configuredVersion}; shared template releases do not change its snapshot.`}
                </div>
              )}
            </fieldset>

            <fieldset className="website-onboarding-group">
              <legend>Brand identity</legend>
              <p className="website-group-hint">These details replace the starter brand across the tenant website.</p>
              <div className="website-field-grid">
                <label className="website-field">
                  Brand or organization name
                  <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
                </label>

                <label className="website-field">
                  Tagline or positioning statement
                  <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} />
                </label>
              </div>
            </fieldset>

            <details className="website-advanced-options website-optional-details">
              <summary>
                <span><strong>Contact and payment details</strong><small>Optional email, phone, address, and M-Pesa info</small></span>
                <span className="website-advanced-indicator">Add details</span>
              </summary>
              <div className="website-optional-grid">
                <div className="website-optional-group">
                  <h3>Contact</h3>
                  <div className="website-field-grid">
                    <label className="website-field">
                      Contact email
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hello@company.example" />
                    </label>
                    <label className="website-field">
                      Primary phone
                      <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000000" />
                    </label>
                    <label className="website-field website-field--wide">
                      Location or HQ address
                      <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="City / Road / Suite" />
                    </label>
                  </div>
                </div>
                <div className="website-optional-group">
                  <h3>Payments</h3>
                  <div className="website-field-grid">
                    <label className="website-field">
                      M-Pesa Paybill
                      <input type="text" value={mpesaPaybill} onChange={(e) => setMpesaPaybill(e.target.value)} placeholder="e.g. 522522" />
                    </label>
                    <label className="website-field">
                      Account or payment reference
                      <input type="text" value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="e.g. INVOICE or TITHE" />
                    </label>
                  </div>
                </div>
              </div>
            </details>

            <div className="website-module-summary">
              <div>
                <strong>Included modules</strong>
                <p>Automatically enabled for {activePackage.name}.</p>
              </div>
              <div className="website-module-chips">
                {activePackage.assignableModules.map((module) => (
                  <span key={module}>{module}</span>
                ))}
              </div>
            </div>

            <label className="website-starter-option">
              <input
                type="checkbox"
                checked={includeStarterContent}
                onChange={(e) => setIncludeStarterContent(e.target.checked)}
              />
              <span>
                <strong>Include starter content</strong>
                <small>Add sample pages, copy, and offerings with the tenant’s brand applied.</small>
              </span>
            </label>

            <div className="website-form-footer">
              <p>Review the package and brand details before applying them to this tenant.</p>
              <button type="submit" className="primary website-onboarding-submit" disabled={busy || tenantStatus === "closed"}>
                {busy ? "White-labeling package…" : `Apply ${activePackage.name} Template`}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div>
          <form onSubmit={handleImportRepo} className="website-onboarding-form">
            <fieldset className="website-onboarding-group">
              <legend>Source repository</legend>
              <p className="website-group-hint">Connect the public GitHub repository and branch that contain the website.</p>
              <div className="website-field-grid">
                <label className="website-field">
                  GitHub repository URL
                  <input type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/website-repo" required />
                </label>

                <label className="website-field">
                  Branch
                  <input type="text" value={branch} onChange={(e) => setBranch(e.target.value)} required />
                </label>
              </div>
            </fieldset>

            <fieldset className="website-onboarding-group">
              <legend>Import settings</legend>
              <p className="website-group-hint">Choose how the repo should be prepared and hosted for this tenant.</p>
              <div className="website-field-grid website-field-grid--three">
                <label className="website-field">
                  Target platform package
                  <select value={repoPackageMode} onChange={(e) => setRepoPackageMode(e.target.value)}>
                    <option value="auto">Auto-detect from repository</option>
                    {packages.map((item) => (
                      <option key={item.packageId} value={item.packageId}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <label className="website-field">
                  Onboarding mode
                  <select value={importMode} onChange={(e) => setImportMode(e.target.value as "whitelabel-storefront" | "byow-compose")}>
                    <option value="whitelabel-storefront">Shared platform package</option>
                    <option value="byow-compose">Dedicated website deployment</option>
                  </select>
                </label>

                <label className="website-field">
                  Source framework
                  <select
                    value={framework}
                    onChange={(e) => setFramework(e.target.value as "nextjs" | "react-vite" | "astro" | "remix" | "wordpress" | "static" | "custom-docker")}
                  >
                    <option value="nextjs">Next.js</option>
                    <option value="react-vite">React / Vite</option>
                    <option value="astro">Astro</option>
                    <option value="remix">Remix</option>
                    <option value="wordpress">WordPress container</option>
                    <option value="static">Static Nginx site</option>
                    <option value="custom-docker">Custom Dockerfile</option>
                  </select>
                </label>

                <label className="website-field">
                  Target brand name
                  <input type="text" value={brandName} onChange={(e) => setBrandName(e.target.value)} required />
                </label>

                <label className="website-field">
                  Target primary domain <span className="website-optional">Optional</span>
                  <input type="text" value={primaryDomain} onChange={(e) => setPrimaryDomain(e.target.value)} placeholder="app.company.com" />
                </label>
              </div>
            </fieldset>

            <details className="website-advanced-options">
              <summary>
                <span><strong>Advanced source overrides</strong><small>Optional config and style files</small></span>
                <span className="website-advanced-indicator">Show</span>
              </summary>
              <div className="website-field-grid">
                <label className="website-field">
                  Source config override <span className="website-optional">config.ts / site.ts</span>
                  <textarea rows={5} value={configTs} onChange={(e) => setConfigTs(e.target.value)} placeholder='export const SITE_CONFIG = { companyName: "...", email: "..." }' />
                </label>

                <label className="website-field">
                  Source style override <span className="website-optional">tokens.css / globals.css</span>
                  <textarea rows={5} value={tokensCss} onChange={(e) => setTokensCss(e.target.value)} placeholder=":root { --color-primary: #1E293B; --color-accent: #0F766E; }" />
                </label>
              </div>
            </details>

            <label className="website-starter-option">
              <input type="checkbox" checked={applyToTenant} onChange={(e) => setApplyToTenant(e.target.checked)} />
              <span>
                <strong>Save settings to this tenant</strong>
                <small>Store the white-label package settings or generated deployment blueprint in the workspace.</small>
              </span>
            </label>

            <div className="website-form-footer">
              <p>The repository is analyzed before the tenant setup is saved.</p>
              <button type="submit" className="primary website-onboarding-submit" disabled={busy || tenantStatus === "closed"}>
                {busy ? "Analyzing & white-labeling…" : "Import repository and prepare site"}
              </button>
            </div>
          </form>
        </div>
      )}

      {feedback && (
        <p className="feedback website-onboarding-feedback" role="status">
          {feedback}
        </p>
      )}

      {variables.length > 0 && (
        <div className="website-onboarding-result">
          <div className="panel-head">
            <div>
              <p className="eyebrow">WHITE-LABEL EXTRACTION</p>
              <h3>Detected source literals → tenant variables</h3>
            </div>
            <span className="count">{variables.length} VARIABLES</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>VARIABLE PATH</th>
                  <th>CATEGORY</th>
                  <th>DETECTED SOURCE LITERAL</th>
                  <th>TARGET TENANT VALUE</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((item) => (
                  <tr key={`${item.variable}:${item.detectedLiteral}`}>
                    <td>
                      <code>{item.variable}</code>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.detectedLiteral}</td>
                    <td>{item.replacementPreview}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {blueprint && (
        <div className="website-onboarding-result">
          <div className="panel-head">
            <div>
              <p className="eyebrow">
                DOKPLOY BYOW COMPOSE BLUEPRINT
                {blueprint.packageId ? ` · ${blueprint.packageId.toUpperCase()}` : ""}
              </p>
              <h3>{blueprint.composePath}</h3>
            </div>
            <span className="count">PORT {blueprint.internalPort}</span>
          </div>
          <pre className="website-blueprint-preview">
            {blueprint.composeYaml}
          </pre>
        </div>
      )}
    </section>
  );
}
