"use client";

import { useEffect, useState, useCallback } from "react";
import { pulse } from "@bazion/ui";
import {
  churchPublicSiteSettingsSchema,
  type ChurchPublicSiteSettings,
  type ChurchSiteSettingsInput,
  type SiteSettingsVersionSummary,
} from "@bazion/church-ministry-contracts";
import { churchThemePresets, type ThemePresetDefinition } from "@bazion/church-ministry-template";
import { apiErrorMessage } from "../../lib/api-error";
import { addSiteNavigationItem, removeSiteNavigationItem, setSitePageEnabled, updateSiteNavigationItem } from "../../lib/site-settings-navigation";
import { MediaUploadField } from "./media-upload-field";

type SiteProfile = ChurchSiteSettingsInput["profile"];
type RowName = "serviceTimes" | "locations" | "ministries" | "faqs" | "coreValues" | "statementOfFaith";

const ROW_HELPERS: Record<RowName, { title: string; hint: string; sample: string }> = {
  serviceTimes: {
    title: "Service times",
    hint: "Label | Day | Time | Optional Note",
    sample: "Sunday Worship | Sunday | 10:00 AM | Main sanctuary",
  },
  locations: {
    title: "Locations",
    hint: "Name | Address | Optional Map URL",
    sample: "Main Campus | 123 Faith Way, Nairobi | https://maps.google.com",
  },
  ministries: {
    title: "Ministries",
    hint: "Title | Description | Optional Audience",
    sample: "Youth Ministry | Inspiring the next generation through worship and discipleship | Youth & Young Adults",
  },
  faqs: {
    title: "FAQs",
    hint: "Question | Answer",
    sample: "What should I wear? | Come as you are! We welcome everyone in casual or formal attire.",
  },
  coreValues: {
    title: "Core values",
    hint: "Title | Description | Optional Emoji/Icon",
    sample: "Biblical Truth | Grounded firmly in scripture and God's living word | 📖",
  },
  statementOfFaith: {
    title: "Statement of faith",
    hint: "Topic | Belief statement",
    sample: "The Scriptures | We believe the Bible is the inspired, authoritative, and infallible Word of God.",
  },
};

const COLOR_PRESETS = [
  { name: "Maroon & Gold (GMFC)", primary: "#4A1110", secondary: "#6B1A18", accent: "#B45E14" },
  { name: "Forest Bronze", primary: "#193a31", secondary: "#315e50", accent: "#8b5b29" },
  { name: "Ocean Navy", primary: "#0f2b48", secondary: "#1e4976", accent: "#7a4d1d" },
  { name: "Deep Charcoal", primary: "#18181b", secondary: "#27272a", accent: "#713f12" },
  { name: "Living Waters", primary: "#0F4C5C", secondary: "#136F63", accent: "#C25E00" },
] as const;

function ensureAccessibleColor(color: string | undefined, fallback: string): string {
  if (!color || typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color)) return fallback;
  const channels = color.slice(1).match(/.{2}/g)?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) return fallback;
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  const contrast = 1.05 / (luminance + 0.05);
  return contrast >= 4.5 ? color : fallback;
}

function sanitizeBranding(branding: ChurchPublicSiteSettings["branding"]): ChurchPublicSiteSettings["branding"] {
  return {
    ...branding,
    primaryColor: ensureAccessibleColor(branding.primaryColor, "#193a31"),
    secondaryColor: ensureAccessibleColor(branding.secondaryColor, "#315e50"),
    accentColor: ensureAccessibleColor(branding.accentColor, "#8b5b29"),
  };
}

function formatValidationErrorMessage(reason: unknown): string {
  if (reason && typeof reason === "object") {
    if ("issues" in reason && Array.isArray((reason as { issues: unknown[] }).issues)) {
      const issues = (reason as { issues: Array<{ path?: Array<string | number>; message?: string }> }).issues;
      if (issues.length > 0) {
        return issues
          .map((issue) => {
            const field = (issue.path || [])
              .filter(Boolean)
              .map((segment) => String(segment).replace(/([A-Z])/g, " $1").toLowerCase())
              .join(" › ");
            return field ? `${field}: ${issue.message}` : (issue.message || "Invalid input");
          })
          .join(" | ");
      }
    }
  }

  if (reason instanceof Error) {
    if (reason.message.startsWith("[")) {
      try {
        const issues = JSON.parse(reason.message);
        if (Array.isArray(issues) && issues.length > 0) {
          return issues
            .map((issue: { path?: string[]; message?: string }) => `${(issue.path || []).join(".")}: ${issue.message}`)
            .join(" | ");
        }
      } catch {
        // use raw message
      }
    }
    return reason.message;
  }
  return "Could not save website settings.";
}

function parseRows<T>(value: string, convert: (parts: string[]) => T | null, fieldName: string): T[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line, lineIndex) => {
    const parts = line.split("|").map((part) => part.trim());
    const item = convert(parts);
    if (!item) throw new Error(`In "${fieldName}" (line ${lineIndex + 1}): "${line}" does not have the expected format with "|" separators.`);
    return [item];
  });
}

function splitPair(line: string): [string, string] {
  const separator = line.indexOf("|");
  return separator < 0 ? [line, ""] : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
}

function rowsText(settings: ChurchPublicSiteSettings, key: RowName): string {
  if (key === "serviceTimes") return settings.serviceTimes.map((row) => [row.label, row.day, row.time, row.note ?? ""].join(" | ")).join("\n");
  if (key === "locations") return settings.locations.map((row) => [row.name, row.address, row.mapUrl ?? ""].join(" | ")).join("\n");
  if (key === "ministries") return settings.ministries.map((row) => [row.title, row.description, row.audience ?? ""].join(" | ")).join("\n");
  if (key === "faqs") return settings.faqs.map((row) => [row.question, row.answer].join(" | ")).join("\n");
  if (key === "coreValues") return settings.coreValues.map((row) => [row.title, row.description, row.icon ?? ""].join(" | ")).join("\n");
  return settings.statementOfFaith.map((row) => [row.topic, row.belief].join(" | ")).join("\n");
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    cache: "no-store",
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  const body = await response.json().catch(() => null) as { message?: string; error?: string } | T | null;
  if (!response.ok) {
    throw new Error(apiErrorMessage(body, response.status));
  }
  return body as T;
}

export function SiteSettingsEditor() {
  const [profile, setProfile] = useState<SiteProfile | null>(null);
  const [settings, setSettings] = useState<ChurchPublicSiteSettings>(() => churchPublicSiteSettingsSchema.parse({}));
  const [rotatorWordsText, setRotatorWordsText] = useState("");
  const [rows, setRows] = useState<Record<RowName, string>>({
    serviceTimes: "", locations: "", ministries: "", faqs: "", coreValues: "", statementOfFaith: "",
  });
  const [versions, setVersions] = useState<SiteSettingsVersionSummary[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [changelogNote, setChangelogNote] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadVersions = useCallback(async () => {
    try {
      const res = await requestJson<{ versions: SiteSettingsVersionSummary[] }>("/v1/admin/church/site-settings/versions");
      setVersions(res.versions ?? []);
      setHasDraft((res.versions ?? []).some((v) => v.status === "draft"));
    } catch {
      // ignore
    }
  }, []);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await requestJson<{ profile: SiteProfile; settings: ChurchPublicSiteSettings }>("/v1/admin/church/site-settings");
      setProfile(result.profile);
      const initialSettings = churchPublicSiteSettingsSchema.parse({
        ...result.settings,
        branding: sanitizeBranding(result.settings.branding),
      });
      setSettings(initialSettings);
      setRotatorWordsText((initialSettings.hero.rotatorWords ?? []).join(", "));
      setRows({
        serviceTimes: rowsText(initialSettings, "serviceTimes"),
        locations: rowsText(initialSettings, "locations"),
        ministries: rowsText(initialSettings, "ministries"),
        faqs: rowsText(initialSettings, "faqs"),
        coreValues: rowsText(initialSettings, "coreValues"),
        statementOfFaith: rowsText(initialSettings, "statementOfFaith"),
      });
      await loadVersions();
    } catch (reason: unknown) {
      setError(formatValidationErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [loadVersions]);

  useEffect(() => {
    let active = true;
    void loadInitial();
    return () => { active = false; };
  }, [loadInitial]);

  function setContact<K extends keyof SiteProfile["contact"]>(key: K, value: SiteProfile["contact"][K]) {
    if (!profile) return;
    setProfile({ ...profile, contact: { ...profile.contact, [key]: value } });
  }

  function setSocial<K extends keyof SiteProfile["social"]>(key: K, value: string) {
    if (!profile) return;
    let formatted = value.trim();
    if (key === "whatsapp" && formatted && !formatted.startsWith("http://") && !formatted.startsWith("https://")) {
      const digits = formatted.replace(/\D/g, "");
      if (digits.startsWith("0") && digits.length === 10) {
        formatted = `https://wa.me/254${digits.slice(1)}`;
      } else if (digits.length >= 9) {
        formatted = `https://wa.me/${digits}`;
      }
    }
    setProfile({ ...profile, social: { ...profile.social, [key]: formatted } });
  }

  function appendSampleRow(key: RowName) {
    setRows((prev) => {
      const sample = ROW_HELPERS[key].sample;
      const current = prev[key].trim();
      return { ...prev, [key]: current ? `${current}\n${sample}` : sample };
    });
  }

  function applyThemePreset(preset: ThemePresetDefinition) {
    setSettings((current) => ({
      ...current,
      theme: {
        preset: preset.id,
        headerStyle: preset.headerStyle,
        heroStyle: preset.heroStyle,
        cardStyle: preset.cardStyle,
        fontPairing: preset.fontPairing,
      },
      branding: {
        ...current.branding,
        primaryColor: preset.primaryColor,
        secondaryColor: preset.secondaryColor,
        accentColor: preset.accentColor,
      },
    }));
    pulse.info(`Applied "${preset.name}" preset.`);
  }

  function buildParsedSettings(): ChurchPublicSiteSettings {
    const rotatorWords = rotatorWordsText
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);

    return churchPublicSiteSettingsSchema.parse({
      ...settings,
      theme: {
        preset: settings.theme?.preset ?? "maroon-gold",
        headerStyle: settings.theme?.headerStyle ?? "classic",
        heroStyle: settings.theme?.heroStyle ?? "rotator",
        cardStyle: settings.theme?.cardStyle ?? "rounded",
        fontPairing: settings.theme?.fontPairing ?? "outfit-inter",
      },
      branding: {
        ...settings.branding,
        primaryColor: ensureAccessibleColor(settings.branding.primaryColor, "#193a31"),
        secondaryColor: ensureAccessibleColor(settings.branding.secondaryColor, "#315e50"),
        accentColor: ensureAccessibleColor(settings.branding.accentColor, "#8b5b29"),
        heroImageUrl: settings.branding.heroImageUrl?.trim() || undefined,
      },
      hero: {
        ...settings.hero,
        rotatorWords,
      },
      online: { ...settings.online, liveStreamUrl: settings.online.liveStreamUrl?.trim() || undefined },
      serviceTimes: parseRows(rows.serviceTimes, (parts) => parts.length >= 3 && parts[0] && parts[1] && parts[2]
        ? { label: parts[0], day: parts[1], time: parts[2], note: parts[3] || undefined } : null, "Service times"),
      locations: parseRows(rows.locations, (parts) => parts.length >= 2 && parts[0] && parts[1]
        ? { name: parts[0], address: parts[1], mapUrl: parts[2] || undefined } : null, "Locations"),
      ministries: parseRows(rows.ministries, (parts) => parts.length >= 2 && parts[0] && parts[1]
        ? { title: parts[0], description: parts[1], audience: parts[2] || undefined } : null, "Ministries"),
      faqs: parseRows(rows.faqs, (parts) => { const [question, answer] = splitPair(parts.join(" | ")); return question && answer ? { question, answer } : null; }, "FAQs"),
      coreValues: parseRows(rows.coreValues, (parts) => parts.length >= 2 && parts[0] && parts[1]
        ? { title: parts[0], description: parts[1], icon: parts[2] || undefined } : null, "Core values"),
      statementOfFaith: parseRows(rows.statementOfFaith, (parts) => { const [topic, belief] = splitPair(parts.join(" | ")); return topic && belief ? { topic, belief } : null; }, "Statement of faith"),
      galleryImages: settings.galleryImages
        .filter((item) => item.imageUrl?.trim())
        .map((item) => ({
          imageUrl: item.imageUrl.trim(),
          alt: item.alt?.trim().length >= 3 ? item.alt.trim() : "Gallery photo",
          caption: item.caption?.trim() || undefined,
        })),
      leadership: settings.leadership
        .filter((item) => item.name?.trim())
        .map((item) => ({
          name: item.name.trim(),
          role: item.role?.trim() || "Ministry Leader",
          bio: item.bio?.trim() || undefined,
          photoUrl: item.photoUrl?.trim() || undefined,
        })),
      giving: { ...settings.giving, suggestedAmounts: settings.giving.suggestedAmounts },
    });
  }

  async function saveDraft() {
    if (!profile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const parsedSettings = buildParsedSettings();
      await pulse.track(
        () => requestJson("/v1/admin/church/site-settings/draft", {
          method: "PUT",
          body: JSON.stringify({ profile, settings: parsedSettings }),
        }),
        {
          pending: "Saving website draft…",
          success: "Website draft saved",
          group: "ministry:site-draft",
        },
      );
      setSettings(parsedSettings);
      setNotice("Draft saved successfully. It is ready for preview before publishing live.");
      await loadVersions();
    } catch (reason) {
      setError(formatValidationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function publishLive(event?: React.FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (!profile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const parsedSettings = buildParsedSettings();
      await pulse.track(
        () => requestJson("/v1/admin/church/site-settings/publish", {
          method: "POST",
          body: JSON.stringify({
            profile,
            settings: parsedSettings,
            changelog: changelogNote.trim() || undefined,
          }),
        }),
        {
          pending: "Publishing website live…",
          success: "Website published live!",
          group: "ministry:site-publish",
        },
      );
      setSettings(parsedSettings);
      setChangelogNote("");
      setNotice("Website settings published live! Visitors can now see your latest changes.");
      await loadVersions();
    } catch (reason) {
      setError(formatValidationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function discardDraft() {
    const ok = await pulse.confirm({
      title: "Discard Draft Changes?",
      message: "Are you sure you want to discard your unpublished draft? Any unsaved edits will be removed.",
      tone: "danger",
      confirmLabel: "Discard Draft",
    });
    if (!ok) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await pulse.track(
        () => requestJson("/v1/admin/church/site-settings/draft", { method: "DELETE" }),
        { pending: "Discarding draft…", success: "Draft discarded", group: "ministry:site-draft" },
      );
      setNotice("Draft discarded. Restored currently published settings.");
      await loadInitial();
    } catch (reason) {
      setError(formatValidationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function rollbackToVersion(versionNumber: number) {
    const ok = await pulse.confirm({
      title: `Rollback to Version ${versionNumber}?`,
      message: `This will restore website settings to version ${versionNumber} and publish them live immediately.`,
      tone: "warning",
      confirmLabel: `Rollback to v${versionNumber}`,
    });
    if (!ok) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await pulse.track(
        () => requestJson(`/v1/admin/church/site-settings/versions/${versionNumber}/rollback`, {
          method: "POST",
        }),
        {
          pending: `Rolling back to version ${versionNumber}…`,
          success: `Rolled back to version ${versionNumber}`,
          group: "ministry:site-rollback",
        },
      );
      setNotice(`Website rolled back to version ${versionNumber}. Reloading…`);
      await loadInitial();
    } catch (reason) {
      setError(formatValidationErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading website settings…</p>;
  if (!profile) return <p role="alert">{error || "Website settings are unavailable."}</p>;

  const fieldStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", border: "1px solid var(--church-border)", borderRadius: 10, font: "inherit" };
  const labelStyle: React.CSSProperties = { display: "grid", gap: 7, fontSize: 13, fontWeight: 600 };
  const textareaStyle: React.CSSProperties = { ...fieldStyle, minHeight: 90, resize: "vertical" };
  const sectionStyle: React.CSSProperties = { display: "grid", gap: 16, borderTop: "1px solid var(--church-border)", paddingTop: 22, marginTop: 22 };

  return (
    <form onSubmit={publishLive} style={{ display: "grid", gap: 22 }}>
      {/* Action Header with Draft, Publish, Preview, and Versions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "14px 18px", background: "var(--church-bg-alt)", borderRadius: 12, border: "1px solid var(--church-border)" }}>
        <div>
          <strong style={{ fontSize: 15, color: "var(--church-primary)" }}>Website Publishing Desk</strong>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--church-text-muted)" }}>
            {hasDraft ? "🟡 You have unpublished draft changes." : "🟢 Live version is currently up to date."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {hasDraft && (
            <button type="button" className="ch-btn ch-btn-outline" style={{ fontSize: 13, padding: "6px 12px", color: "#B91C1C", borderColor: "#FCA5A5" }} onClick={discardDraft} disabled={busy}>
              Discard Draft
            </button>
          )}
          <button type="button" className="ch-btn ch-btn-outline" style={{ fontSize: 13, padding: "6px 14px" }} onClick={saveDraft} disabled={busy}>
            {busy ? "Saving…" : "Save Draft"}
          </button>
          <button type="submit" className="ch-btn ch-btn-primary" style={{ fontSize: 13, padding: "6px 16px" }} disabled={busy}>
            {busy ? "Publishing…" : "Publish Live 🚀"}
          </button>
          <button type="button" className="ch-btn ch-btn-outline" style={{ fontSize: 13, padding: "6px 12px" }} onClick={() => setShowVersions(!showVersions)}>
            Version History ({versions.length})
          </button>
          <a className="ch-btn ch-btn-outline" href="/" target="_blank" rel="noreferrer" style={{ fontSize: 13, padding: "6px 12px" }}>
            View Public Site ↗
          </a>
        </div>
      </div>

      {/* Version History Drawer / Panel */}
      {showVersions && (
        <div style={{ border: "1px solid var(--church-border)", borderRadius: 12, padding: 20, background: "#fff", display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--church-primary)" }}>Site Settings Version History & Rollback</h3>
            <button type="button" className="admin-sample-btn" onClick={() => setShowVersions(false)}>Close ✕</button>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--church-text-muted)" }}>
            Every publish creates an immutable version snapshot. You can roll back to any past version with 1 click.
          </p>
          {versions.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--church-text-muted)" }}>No version snapshots recorded yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {versions.map((ver) => (
                <div key={ver.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", border: "1px solid var(--church-border)", borderRadius: 8, background: ver.status === "published" ? "var(--church-bg)" : "#fff" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <strong style={{ fontSize: 14 }}>v{ver.versionNumber}</strong>
                      <span style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: ver.status === "published" ? "#DCFCE7" : ver.status === "draft" ? "#FEF3C7" : "#F3F4F6",
                        color: ver.status === "published" ? "#166534" : ver.status === "draft" ? "#92400E" : "#4B5563",
                      }}>
                        {ver.status}
                      </span>
                      {ver.note && <span style={{ fontSize: 12, color: "var(--church-text-muted)" }}>"{ver.note}"</span>}
                    </div>
                    <small style={{ fontSize: 11, color: "var(--church-text-muted)" }}>
                      {new Date(ver.createdAt).toLocaleString()} {ver.createdBy ? `by ${ver.createdBy}` : ""}
                    </small>
                  </div>
                  <div>
                    {ver.status !== "published" && ver.status !== "draft" && (
                      <button
                        type="button"
                        className="ch-btn ch-btn-outline"
                        style={{ fontSize: 12, padding: "4px 10px" }}
                        onClick={() => rollbackToVersion(ver.versionNumber)}
                        disabled={busy}
                      >
                        Restore v{ver.versionNumber}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" className="admin-error">{error}</p>}
      {notice && <p role="status" className="admin-feedback">{notice}</p>}

      {/* Optional Changelog note on publish */}
      <div style={{ display: "grid", gap: 6 }}>
        <label style={labelStyle}>
          Changelog note for this update (optional)
          <input
            style={fieldStyle}
            maxLength={250}
            placeholder="e.g. Switched to Maroon-Gold preset, updated Sunday service time"
            value={changelogNote}
            onChange={(e) => setChangelogNote(e.target.value)}
          />
        </label>
      </div>

      <section>
        <h2>Ministry profile</h2>
        <div className="ch-site-settings-grid">
          <label style={labelStyle}>Ministry name<input required maxLength={180} style={fieldStyle} value={profile.ministryName} onChange={(event) => setProfile({ ...profile, ministryName: event.target.value })} /></label>
          <label style={labelStyle}>Short introduction<input maxLength={500} style={fieldStyle} value={profile.tagline} onChange={(event) => setProfile({ ...profile, tagline: event.target.value })} /></label>
          <MediaUploadField label="Logo" value={profile.logoUrl ?? ""} onChange={(value) => setProfile({ ...profile, logoUrl: value })} />
          <label style={labelStyle}>Public email<input type="email" style={fieldStyle} value={profile.contact.email} onChange={(event) => setContact("email", event.target.value)} /></label>
          <label style={labelStyle}>Phone numbers (one per line)<textarea style={textareaStyle} value={profile.contact.phones.join("\n")} onChange={(event) => setContact("phones", event.target.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean))} /></label>
          <label style={labelStyle}>Address<textarea style={textareaStyle} value={profile.contact.address} onChange={(event) => setContact("address", event.target.value)} /></label>
          <label style={labelStyle}>Vision<textarea style={textareaStyle} value={profile.vision} onChange={(event) => setProfile({ ...profile, vision: event.target.value })} /></label>
          <label style={labelStyle}>Mission<textarea style={textareaStyle} value={profile.mission} onChange={(event) => setProfile({ ...profile, mission: event.target.value })} /></label>
          <label style={labelStyle}>Community outreach<textarea style={textareaStyle} value={profile.outreach} onChange={(event) => setProfile({ ...profile, outreach: event.target.value })} /></label>
        </div>
        <h3 style={{ marginTop: 20 }}>Social links</h3>
        <div className="ch-site-settings-grid">{(["youtube", "facebook", "instagram", "twitter", "whatsapp"] as const).map((key) => <label key={key} style={labelStyle}>{key[0].toUpperCase() + key.slice(1)}<input type="url" style={fieldStyle} value={profile.social[key] ?? ""} onChange={(event) => setSocial(key, event.target.value)} placeholder={key === "whatsapp" ? "https://wa.me/254…" : "https://…"} />{key === "whatsapp" && <small style={{ fontWeight: 400, lineHeight: 1.5 }}>Add a wa.me link to show the floating WhatsApp button on public pages.</small>}</label>)}</div>
      </section>

      {/* Themes & Appearance Section */}
      <section style={sectionStyle}>
        <h2>Themes and Brand Styling</h2>
        <p className="admin-muted">
          Choose a curated design theme preset or customize individual colors, font pairings, card corner styles, and header formats.
        </p>

        {/* 1-Click Curated Theme Presets */}
        <div style={{ display: "grid", gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Curated Theme Presets</strong>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {churchThemePresets.map((preset) => {
              const isSelected = settings.theme?.preset === preset.id;
              return (
                <div
                  key={preset.id}
                  style={{
                    border: isSelected ? "2px solid var(--church-accent)" : "1px solid var(--church-border)",
                    borderRadius: 12,
                    padding: "14px",
                    background: isSelected ? "var(--church-bg)" : "#fff",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    cursor: "pointer",
                    boxShadow: isSelected ? "var(--church-shadow-sm)" : "none",
                  }}
                  onClick={() => applyThemePreset(preset)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 14, color: "var(--church-primary)" }}>{preset.name}</strong>
                    {isSelected && <span style={{ fontSize: 11, background: "var(--church-accent)", color: "#fff", padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--church-text-muted)", lineHeight: 1.4 }}>
                    {preset.description}
                  </p>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: preset.primaryColor, border: "1px solid rgba(0,0,0,0.1)" }} title="Primary" />
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: preset.secondaryColor, border: "1px solid rgba(0,0,0,0.1)" }} title="Secondary" />
                    <span style={{ width: 18, height: 18, borderRadius: "50%", background: preset.accentColor, border: "1px solid rgba(0,0,0,0.1)" }} title="Accent" />
                    <small style={{ fontSize: 11, color: "var(--church-text-muted)", marginLeft: "auto" }}>{preset.fontPairing}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Layout Style Controls */}
        <h3 style={{ marginTop: 14, fontSize: 15 }}>Layout & Typography Options</h3>
        <div className="ch-site-settings-grid">
          <label style={labelStyle}>
            Header & Navigation Style
            <select
              style={fieldStyle}
              value={settings.theme?.headerStyle ?? "classic"}
              onChange={(e) => setSettings({
                ...settings,
                theme: { ...settings.theme, headerStyle: e.target.value as "classic" | "centered" | "minimal" },
              })}
            >
              <option value="classic">Classic (Logo left, navigation right)</option>
              <option value="centered">Centered (Logo centered above navigation)</option>
              <option value="minimal">Minimal (Compact modern header)</option>
            </select>
          </label>

          <label style={labelStyle}>
            Hero Banner Style
            <select
              style={fieldStyle}
              value={settings.theme?.heroStyle ?? "rotator"}
              onChange={(e) => setSettings({
                ...settings,
                theme: { ...settings.theme, heroStyle: e.target.value as "rotator" | "centered-bold" | "split-card" },
              })}
            >
              <option value="rotator">Animated Word Rotator (Dynamic rotating keywords)</option>
              <option value="split-card">Split Card (Split banner with hero card)</option>
              <option value="centered-bold">Centered Bold (High-impact statement)</option>
            </select>
          </label>

          <label style={labelStyle}>
            Card Corner Style
            <select
              style={fieldStyle}
              value={settings.theme?.cardStyle ?? "rounded"}
              onChange={(e) => setSettings({
                ...settings,
                theme: { ...settings.theme, cardStyle: e.target.value as "rounded" | "sharp" | "warm-tint" },
              })}
            >
              <option value="rounded">Soft Rounded (12px / 22px border radius)</option>
              <option value="sharp">Crisp Modern (4px / 8px border radius)</option>
              <option value="warm-tint">Warm Pill Tint (16px / 24px border radius)</option>
            </select>
          </label>

          <label style={labelStyle}>
            Font Pairing
            <select
              style={fieldStyle}
              value={settings.theme?.fontPairing ?? "outfit-inter"}
              onChange={(e) => setSettings({
                ...settings,
                theme: { ...settings.theme, fontPairing: e.target.value as "outfit-inter" | "jakarta-inter" | "serif-classic" },
              })}
            >
              <option value="outfit-inter">Outfit Headings + Inter Body (GMFC Signature)</option>
              <option value="jakarta-inter">Plus Jakarta Sans Headings + Inter Body</option>
              <option value="serif-classic">Fraunces Serif Headings + Inter Body</option>
            </select>
          </label>
        </div>

        {/* Hero Content & Word Rotator */}
        <h3 style={{ marginTop: 14, fontSize: 15 }}>Homepage Hero Content</h3>
        <div className="ch-site-settings-grid">
          <label style={labelStyle}>Hero eyebrow<input maxLength={100} style={fieldStyle} value={settings.hero.eyebrow} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, eyebrow: event.target.value } })} /></label>
          <label style={labelStyle}>Hero title prefix<input maxLength={120} style={fieldStyle} value={settings.hero.title} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, title: event.target.value } })} /></label>
          <label style={labelStyle}>Highlighted title<input maxLength={120} style={fieldStyle} value={settings.hero.highlightedTitle} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, highlightedTitle: event.target.value } })} /></label>
          <MediaUploadField label="Homepage hero image" value={settings.branding.heroImageUrl ?? ""} onChange={(value) => setSettings({ ...settings, branding: { ...settings.branding, heroImageUrl: value } })} />
          <label style={labelStyle}>Hero introduction<textarea maxLength={500} style={textareaStyle} value={settings.hero.subtitle} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, subtitle: event.target.value } })} /></label>
          <label style={labelStyle}>
            Animated Rotating Words (comma separated)
            <input
              style={fieldStyle}
              placeholder="e.g. nations, communities, families, generations"
              value={rotatorWordsText}
              onChange={(event) => setRotatorWordsText(event.target.value)}
            />
            <small style={{ fontWeight: 400, color: "var(--church-text-muted)" }}>
              Displayed when Hero Style is set to "Animated Word Rotator".
            </small>
          </label>
          <label style={labelStyle}>Live stream URL<input type="url" style={fieldStyle} value={settings.online.liveStreamUrl ?? ""} onChange={(event) => setSettings({ ...settings, online: { ...settings.online, liveStreamUrl: event.target.value } })} placeholder="https://…" /></label>
          <label style={labelStyle}>Online worship details<textarea maxLength={500} style={textareaStyle} value={settings.online.description} onChange={(event) => setSettings({ ...settings, online: { ...settings.online, description: event.target.value } })} /></label>
          <label style={labelStyle}>Featured scripture (optional)<textarea maxLength={1200} style={textareaStyle} value={settings.scripture.verse} onChange={(event) => setSettings({ ...settings, scripture: { ...settings.scripture, verse: event.target.value } })} /></label>
          <label style={labelStyle}>Scripture reference<input maxLength={120} style={fieldStyle} value={settings.scripture.reference} onChange={(event) => setSettings({ ...settings, scripture: { ...settings.scripture, reference: event.target.value } })} /></label>
          <label style={labelStyle}>Translation<input maxLength={40} style={fieldStyle} value={settings.scripture.version} onChange={(event) => setSettings({ ...settings, scripture: { ...settings.scripture, version: event.target.value } })} /></label>
        </div>

        {/* Custom Hex Color Override */}
        <h3 style={{ marginTop: 14, fontSize: 15 }}>Brand Color Palette</h3>
        <div className="ch-site-settings-grid">
          {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => <label key={key} style={labelStyle}>{key.replace("Color", " color")}<div style={{ display: "flex", gap: 9 }}><input aria-label={key} type="color" value={settings.branding[key]} onChange={(event) => setSettings({ ...settings, branding: { ...settings.branding, [key]: event.target.value } })} /><input style={fieldStyle} pattern="#[0-9a-fA-F]{6}" value={settings.branding[key]} onChange={(event) => setSettings({ ...settings, branding: { ...settings.branding, [key]: event.target.value } })} /></div></label>)}
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <small className="admin-muted">Colors require at least 4.5:1 contrast against white backgrounds to ensure readability.</small>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Quick color swatches:</span>
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                className="ch-btn ch-btn-outline"
                style={{ fontSize: 12, padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                onClick={() => setSettings((current) => ({
                  ...current,
                  branding: {
                    ...current.branding,
                    primaryColor: preset.primary,
                    secondaryColor: preset.secondary,
                    accentColor: preset.accent,
                  },
                }))}
              >
                <span style={{ display: "inline-flex", gap: 3 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: preset.primary, display: "inline-block" }} />
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: preset.secondary, display: "inline-block" }} />
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: preset.accent, display: "inline-block" }} />
                </span>
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Navigation and page visibility</h2>
        <p className="admin-muted">Choose which pages appear in the public menu, then edit, add, or remove links. The home page must remain enabled. Internal links must use a configured page path; partner links must use HTTPS.</p>
        <div className="ministry-content-list">
          <strong>Published pages</strong>
          {settings.pages.map((page) => <label key={page.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={page.enabled}
              disabled={page.id === "home"}
              aria-label={`${page.title} page enabled`}
              onChange={(event) => setSettings((current) => setSitePageEnabled(current, page.id, event.target.checked))}
            />
            <span>{page.title} <small className="admin-muted">{page.path}</small></span>
          </label>)}
        </div>
        <div className="ministry-content-list">
          <div className="ministry-content-list-heading">
            <div><strong>Main navigation</strong><small>Links appear in the order shown. A disabled page’s link is hidden automatically.</small></div>
            <button type="button" className="ministry-media-button" disabled={settings.navigation.length >= 12} onClick={() => setSettings((current) => addSiteNavigationItem(current))}>Add link</button>
          </div>
          {settings.navigation.map((item, index) => <article className="ministry-content-entry" key={item.id}>
            <div className="ch-site-settings-grid">
              <label style={labelStyle}>Link label<input required maxLength={50} style={fieldStyle} value={item.label} onChange={(event) => setSettings((current) => updateSiteNavigationItem(current, index, { label: event.target.value }))} /></label>
              <label style={labelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span>Destination</span>
                  <small className="admin-muted">e.g. /about, /sermons, or https://partner.org</small>
                </div>
                <input
                  required
                  maxLength={2048}
                  style={fieldStyle}
                  value={item.href}
                  onChange={(event) => {
                    let href = event.target.value.trim();
                    if (href && !href.startsWith("/") && !href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("#")) {
                      href = `/${href}`;
                    }
                    setSettings((current) => updateSiteNavigationItem(current, index, { href }));
                  }}
                  placeholder="/about or https://partner.example.org"
                />
              </label>
            </div>
            <button type="button" className="admin-danger-button" onClick={() => setSettings((current) => removeSiteNavigationItem(current, index))}>Remove link</button>
          </article>)}
          {!settings.navigation.length && <p className="admin-muted">No navigation links have been added.</p>}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Visit information</h2>
        <p className="admin-muted">One entry per line. Separate fields with a vertical bar, for example: Sunday Worship | Sunday | 10:00 AM | Main sanctuary.</p>
        <div className="ch-site-settings-grid">
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>{ROW_HELPERS.serviceTimes.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <small className="admin-muted">{ROW_HELPERS.serviceTimes.hint}</small>
                <button type="button" className="admin-sample-btn" onClick={() => appendSampleRow("serviceTimes")}>+ Insert sample</button>
              </div>
            </div>
            <textarea style={textareaStyle} value={rows.serviceTimes} onChange={(event) => setRows({ ...rows, serviceTimes: event.target.value })} placeholder="Sunday Worship | Sunday | 10:00 AM | Main sanctuary" />
          </label>
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>{ROW_HELPERS.locations.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <small className="admin-muted">{ROW_HELPERS.locations.hint}</small>
                <button type="button" className="admin-sample-btn" onClick={() => appendSampleRow("locations")}>+ Insert sample</button>
              </div>
            </div>
            <textarea style={textareaStyle} value={rows.locations} onChange={(event) => setRows({ ...rows, locations: event.target.value })} placeholder="Main campus | Street address | https://maps.google.com/…" />
          </label>
          <label style={labelStyle}>What to expect<textarea style={textareaStyle} value={settings.visitorInfo.arrival} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, arrival: event.target.value } })} /></label>
          <label style={labelStyle}>Children and families<textarea style={textareaStyle} value={settings.visitorInfo.children} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, children: event.target.value } })} /></label>
          <label style={labelStyle}>Accessibility information<textarea style={textareaStyle} value={settings.visitorInfo.accessibility} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, accessibility: event.target.value } })} /></label>
          <label style={labelStyle}>Parking and transport<textarea style={textareaStyle} value={settings.visitorInfo.parking} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, parking: event.target.value } })} /></label>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Ministries and common questions</h2>
        <div className="ch-site-settings-grid">
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>{ROW_HELPERS.ministries.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <small className="admin-muted">{ROW_HELPERS.ministries.hint}</small>
                <button type="button" className="admin-sample-btn" onClick={() => appendSampleRow("ministries")}>+ Insert sample</button>
              </div>
            </div>
            <textarea style={textareaStyle} value={rows.ministries} onChange={(event) => setRows({ ...rows, ministries: event.target.value })} />
          </label>
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>{ROW_HELPERS.faqs.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <small className="admin-muted">{ROW_HELPERS.faqs.hint}</small>
                <button type="button" className="admin-sample-btn" onClick={() => appendSampleRow("faqs")}>+ Insert sample</button>
              </div>
            </div>
            <textarea style={textareaStyle} value={rows.faqs} onChange={(event) => setRows({ ...rows, faqs: event.target.value })} />
          </label>
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>{ROW_HELPERS.coreValues.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <small className="admin-muted">{ROW_HELPERS.coreValues.hint}</small>
                <button type="button" className="admin-sample-btn" onClick={() => appendSampleRow("coreValues")}>+ Insert sample</button>
              </div>
            </div>
            <textarea style={textareaStyle} value={rows.coreValues} onChange={(event) => setRows({ ...rows, coreValues: event.target.value })} />
          </label>
          <label style={labelStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
              <span>{ROW_HELPERS.statementOfFaith.title}</span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <small className="admin-muted">{ROW_HELPERS.statementOfFaith.hint}</small>
                <button type="button" className="admin-sample-btn" onClick={() => appendSampleRow("statementOfFaith")}>+ Insert sample</button>
              </div>
            </div>
            <textarea style={textareaStyle} value={rows.statementOfFaith} onChange={(event) => setRows({ ...rows, statementOfFaith: event.target.value })} />
          </label>
          <div className="ministry-content-list">
            <div className="ministry-content-list-heading"><div><strong>Leadership team</strong><small>Add names, roles, biographies, and optional portraits.</small></div><button type="button" className="ministry-media-button" disabled={settings.leadership.length >= 30} onClick={() => setSettings({ ...settings, leadership: [...settings.leadership, { name: "", role: "", bio: "", photoUrl: undefined }] })}>Add leader</button></div>
            {settings.leadership.map((leader, index) => <article className="ministry-content-entry" key={`leader-${index}`}>
              <div className="ch-site-settings-grid">
                <label style={labelStyle}>Name<input maxLength={160} style={fieldStyle} value={leader.name} onChange={(event) => setSettings({ ...settings, leadership: settings.leadership.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) })} /></label>
                <label style={labelStyle}>Role<input maxLength={120} style={fieldStyle} value={leader.role} onChange={(event) => setSettings({ ...settings, leadership: settings.leadership.map((item, itemIndex) => itemIndex === index ? { ...item, role: event.target.value } : item) })} /></label>
                <label style={labelStyle}>Biography<textarea maxLength={1200} style={textareaStyle} value={leader.bio ?? ""} onChange={(event) => setSettings({ ...settings, leadership: settings.leadership.map((item, itemIndex) => itemIndex === index ? { ...item, bio: event.target.value } : item) })} /></label>
                <MediaUploadField label={`Portrait for ${leader.name || "leader"}`} value={leader.photoUrl ?? ""} onChange={(value) => setSettings({ ...settings, leadership: settings.leadership.map((item, itemIndex) => itemIndex === index ? { ...item, photoUrl: value || undefined } : item) })} />
              </div>
              <button type="button" className="admin-danger-button" onClick={() => setSettings({ ...settings, leadership: settings.leadership.filter((_, itemIndex) => itemIndex !== index) })}>Remove leader</button>
            </article>)}
            {!settings.leadership.length && <p className="admin-muted">No leaders have been added yet.</p>}
          </div>
          <div className="ministry-content-list">
            <div className="ministry-content-list-heading"><div><strong>Photo gallery</strong><small>Upload a photo, write meaningful alt text, and add an optional caption.</small></div><button type="button" className="ministry-media-button" disabled={settings.galleryImages.length >= 60} onClick={() => setSettings({ ...settings, galleryImages: [...settings.galleryImages, { imageUrl: "", alt: "", caption: "" }] })}>Add photo</button></div>
            {settings.galleryImages.map((image, index) => <article className="ministry-content-entry" key={`gallery-${index}`}>
              <MediaUploadField label={`Gallery photo ${index + 1}`} value={image.imageUrl} onChange={(value) => setSettings({ ...settings, galleryImages: settings.galleryImages.map((item, itemIndex) => itemIndex === index ? { ...item, imageUrl: value } : item) })} />
              <label style={labelStyle}>Descriptive alt text<input maxLength={240} minLength={3} style={fieldStyle} value={image.alt} onChange={(event) => setSettings({ ...settings, galleryImages: settings.galleryImages.map((item, itemIndex) => itemIndex === index ? { ...item, alt: event.target.value } : item) })} placeholder="Describe what is happening in this image" /></label>
              <label style={labelStyle}>Caption (optional)<input maxLength={400} style={fieldStyle} value={image.caption ?? ""} onChange={(event) => setSettings({ ...settings, galleryImages: settings.galleryImages.map((item, itemIndex) => itemIndex === index ? { ...item, caption: event.target.value } : item) })} /></label>
              <button type="button" className="admin-danger-button" onClick={() => setSettings({ ...settings, galleryImages: settings.galleryImages.filter((_, itemIndex) => itemIndex !== index) })}>Remove photo</button>
            </article>)}
            {!settings.galleryImages.length && <p className="admin-muted">No gallery photos have been added yet.</p>}
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2>Giving and search appearance</h2>
        <p className="admin-muted">Only publish verified payment details. M-Pesa prompts require the platform payment provider to be configured separately.</p>
        <div className="ch-site-settings-grid">
          <label style={labelStyle}>M-Pesa Paybill<input style={fieldStyle} value={settings.giving.mpesaPaybill} onChange={(event) => setSettings({ ...settings, giving: { ...settings.giving, mpesaPaybill: event.target.value } })} /></label>
          <label style={labelStyle}>Account name or number<input style={fieldStyle} value={settings.giving.accountName} onChange={(event) => setSettings({ ...settings, giving: { ...settings.giving, accountName: event.target.value } })} /></label>
          <label style={labelStyle}>Payment instructions<textarea style={textareaStyle} value={settings.giving.instructions} onChange={(event) => setSettings({ ...settings, giving: { ...settings.giving, instructions: event.target.value } })} /></label>
          <label style={labelStyle}>Suggested amounts (KES, comma separated)<input inputMode="numeric" style={fieldStyle} value={settings.giving.suggestedAmounts.join(", ")} onChange={(event) => setSettings({ ...settings, giving: { ...settings.giving, suggestedAmounts: event.target.value.split(",").map((amount) => Number(amount.trim())).filter(Number.isFinite) } })} /></label>
          <label style={labelStyle}>Browser title<input maxLength={160} style={fieldStyle} value={settings.metadata.title} onChange={(event) => setSettings({ ...settings, metadata: { ...settings.metadata, title: event.target.value } })} /></label>
          <label style={labelStyle}>Search description<textarea maxLength={320} style={textareaStyle} value={settings.metadata.description} onChange={(event) => setSettings({ ...settings, metadata: { ...settings.metadata, description: event.target.value } })} /></label>
        </div>
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", paddingTop: 16 }}>
        <button type="button" className="ch-btn ch-btn-outline" onClick={saveDraft} disabled={busy}>
          {busy ? "Saving…" : "Save Draft"}
        </button>
        <button type="submit" className="ch-btn ch-btn-primary" disabled={busy}>
          {busy ? "Publishing…" : "Publish Website Live 🚀"}
        </button>
        <a className="ch-btn ch-btn-outline" href="/" target="_blank" rel="noreferrer">
          Preview public site ↗
        </a>
      </div>
    </form>
  );
}
