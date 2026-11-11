"use client";

import { useEffect, useState } from "react";
import {
  churchPublicSiteSettingsSchema,
  type ChurchPublicSiteSettings,
  type ChurchSiteSettingsInput,
} from "@bazion/church-ministry-contracts";
import { apiErrorMessage } from "../../lib/api-error";
import { addSiteNavigationItem, removeSiteNavigationItem, setSitePageEnabled, updateSiteNavigationItem } from "../../lib/site-settings-navigation";
import { MediaUploadField } from "./media-upload-field";

type SiteProfile = ChurchSiteSettingsInput["profile"];
type RowName = "serviceTimes" | "locations" | "ministries" | "faqs" | "coreValues" | "statementOfFaith";

const COLOR_PRESETS = [
  { name: "Forest", primary: "#193a31", secondary: "#315e50", accent: "#8b5b29" },
  { name: "Ocean Navy", primary: "#0f2b48", secondary: "#1e4976", accent: "#7a4d1d" },
  { name: "Deep Charcoal", primary: "#18181b", secondary: "#27272a", accent: "#713f12" },
  { name: "Midnight Plum", primary: "#3b122d", secondary: "#581c45", accent: "#831843" },
  { name: "Espresso", primary: "#2c1810", secondary: "#44281d", accent: "#78350f" },
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
            .map((issue: { path?: unknown[]; message?: string }) => {
              const field = Array.isArray(issue.path)
                ? issue.path
                    .filter(Boolean)
                    .map((segment: unknown) => String(segment).replace(/([A-Z])/g, " $1").toLowerCase())
                    .join(" › ")
                : "";
              return field ? `${field}: ${issue.message}` : (issue.message || "Invalid input");
            })
            .join(" | ");
        }
      } catch {
        // Not JSON formatted
      }
    }
    return reason.message;
  }

  return "Website settings could not be saved.";
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
  const [rows, setRows] = useState<Record<RowName, string>>({
    serviceTimes: "", locations: "", ministries: "", faqs: "", coreValues: "", statementOfFaith: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    requestJson<{ profile: SiteProfile; settings: ChurchPublicSiteSettings }>("/v1/admin/church/site-settings")
      .then((result) => {
        if (!active) return;
        setProfile(result.profile);
        const initialSettings = churchPublicSiteSettingsSchema.parse({
          ...result.settings,
          branding: sanitizeBranding(result.settings.branding),
        });
        setSettings(initialSettings);
        setRows({
          serviceTimes: rowsText(initialSettings, "serviceTimes"),
          locations: rowsText(initialSettings, "locations"),
          ministries: rowsText(initialSettings, "ministries"),
          faqs: rowsText(initialSettings, "faqs"),
          coreValues: rowsText(initialSettings, "coreValues"),
          statementOfFaith: rowsText(initialSettings, "statementOfFaith"),
        });
      })
      .catch((reason: unknown) => { if (active) setError(formatValidationErrorMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function setContact<K extends keyof SiteProfile["contact"]>(key: K, value: SiteProfile["contact"][K]) {
    if (!profile) return;
    setProfile({ ...profile, contact: { ...profile.contact, [key]: value } });
  }

  function setSocial<K extends keyof SiteProfile["social"]>(key: K, value: string) {
    if (!profile) return;
    setProfile({ ...profile, social: { ...profile.social, [key]: value } });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const parsedSettings = churchPublicSiteSettingsSchema.parse({
        ...settings,
        branding: {
          ...settings.branding,
          primaryColor: ensureAccessibleColor(settings.branding.primaryColor, "#193a31"),
          secondaryColor: ensureAccessibleColor(settings.branding.secondaryColor, "#315e50"),
          accentColor: ensureAccessibleColor(settings.branding.accentColor, "#8b5b29"),
          heroImageUrl: settings.branding.heroImageUrl?.trim() || undefined,
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
      await requestJson("/v1/admin/church/site-settings", {
        method: "PUT",
        body: JSON.stringify({ profile, settings: parsedSettings }),
      });
      setSettings(parsedSettings);
      setNotice("Website settings saved. Refresh the public site or preview tab to see the changes.");
    } catch (reason) {
      setError(formatValidationErrorMessage(reason));
    } finally { setBusy(false); }
  }

  if (loading) return <p role="status">Loading website settings…</p>;
  if (!profile) return <p role="alert">{error || "Website settings are unavailable."}</p>;

  const fieldStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", border: "1px solid var(--church-border)", borderRadius: 10, font: "inherit" };
  const labelStyle: React.CSSProperties = { display: "grid", gap: 7, fontSize: 13, fontWeight: 600 };
  const textareaStyle: React.CSSProperties = { ...fieldStyle, minHeight: 90, resize: "vertical" };
  const sectionStyle: React.CSSProperties = { display: "grid", gap: 16, borderTop: "1px solid var(--church-border)", paddingTop: 22, marginTop: 22 };

  return <form onSubmit={save} style={{ display: "grid", gap: 22 }}>
    <p>Manage the information visitors see. Leave a section blank when it does not apply to your ministry.</p>
    {error && <p role="alert" className="admin-error">{error}</p>}{notice && <p role="status" className="admin-feedback">{notice}</p>}

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

    <section style={sectionStyle}>
      <h2>Homepage and appearance</h2>
      <div className="ch-site-settings-grid">
        <label style={labelStyle}>Hero eyebrow<input maxLength={100} style={fieldStyle} value={settings.hero.eyebrow} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, eyebrow: event.target.value } })} /></label>
        <label style={labelStyle}>Hero title<input maxLength={120} style={fieldStyle} value={settings.hero.title} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, title: event.target.value } })} /></label>
        <label style={labelStyle}>Highlighted title<input maxLength={120} style={fieldStyle} value={settings.hero.highlightedTitle} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, highlightedTitle: event.target.value } })} /></label>
        <MediaUploadField label="Homepage hero image" value={settings.branding.heroImageUrl ?? ""} onChange={(value) => setSettings({ ...settings, branding: { ...settings.branding, heroImageUrl: value } })} />
        <label style={labelStyle}>Hero introduction<textarea maxLength={500} style={textareaStyle} value={settings.hero.subtitle} onChange={(event) => setSettings({ ...settings, hero: { ...settings.hero, subtitle: event.target.value } })} /></label>
        <label style={labelStyle}>Live stream URL<input type="url" style={fieldStyle} value={settings.online.liveStreamUrl ?? ""} onChange={(event) => setSettings({ ...settings, online: { ...settings.online, liveStreamUrl: event.target.value } })} placeholder="https://…" /></label>
        <label style={labelStyle}>Online worship details<textarea maxLength={500} style={textareaStyle} value={settings.online.description} onChange={(event) => setSettings({ ...settings, online: { ...settings.online, description: event.target.value } })} /></label>
        <label style={labelStyle}>Featured scripture (optional)<textarea maxLength={1200} style={textareaStyle} value={settings.scripture.verse} onChange={(event) => setSettings({ ...settings, scripture: { ...settings.scripture, verse: event.target.value } })} /></label>
        <label style={labelStyle}>Scripture reference<input maxLength={120} style={fieldStyle} value={settings.scripture.reference} onChange={(event) => setSettings({ ...settings, scripture: { ...settings.scripture, reference: event.target.value } })} /></label>
        <label style={labelStyle}>Translation<input maxLength={40} style={fieldStyle} value={settings.scripture.version} onChange={(event) => setSettings({ ...settings, scripture: { ...settings.scripture, version: event.target.value } })} /></label>
      </div>
      <div className="ch-site-settings-grid" style={{ marginTop: 16 }}>
        {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => <label key={key} style={labelStyle}>{key.replace("Color", " color")}<div style={{ display: "flex", gap: 9 }}><input aria-label={key} type="color" value={settings.branding[key]} onChange={(event) => setSettings({ ...settings, branding: { ...settings.branding, [key]: event.target.value } })} /><input style={fieldStyle} pattern="#[0-9a-fA-F]{6}" value={settings.branding[key]} onChange={(event) => setSettings({ ...settings, branding: { ...settings.branding, [key]: event.target.value } })} /></div></label>)}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <small className="admin-muted">Colors require at least 4.5:1 contrast against white backgrounds to ensure readability.</small>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Accessible palettes:</span>
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
            <label style={labelStyle}>Destination<input required maxLength={2048} style={fieldStyle} value={item.href} onChange={(event) => setSettings((current) => updateSiteNavigationItem(current, index, { href: event.target.value }))} placeholder="/about or https://partner.example.org" /></label>
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
        <label style={labelStyle}>Service times<textarea style={textareaStyle} value={rows.serviceTimes} onChange={(event) => setRows({ ...rows, serviceTimes: event.target.value })} placeholder="Sunday Worship | Sunday | 10:00 AM | Main sanctuary" /></label>
        <label style={labelStyle}>Locations<textarea style={textareaStyle} value={rows.locations} onChange={(event) => setRows({ ...rows, locations: event.target.value })} placeholder="Main campus | Street address | https://maps.google.com/…" /></label>
        <label style={labelStyle}>What to expect<textarea style={textareaStyle} value={settings.visitorInfo.arrival} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, arrival: event.target.value } })} /></label>
        <label style={labelStyle}>Children and families<textarea style={textareaStyle} value={settings.visitorInfo.children} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, children: event.target.value } })} /></label>
        <label style={labelStyle}>Accessibility information<textarea style={textareaStyle} value={settings.visitorInfo.accessibility} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, accessibility: event.target.value } })} /></label>
        <label style={labelStyle}>Parking and transport<textarea style={textareaStyle} value={settings.visitorInfo.parking} onChange={(event) => setSettings({ ...settings, visitorInfo: { ...settings.visitorInfo, parking: event.target.value } })} /></label>
      </div>
    </section>

    <section style={sectionStyle}>
      <h2>Ministries and common questions</h2>
      <div className="ch-site-settings-grid">
        <label style={labelStyle}>Ministries (title | description | audience)<textarea style={textareaStyle} value={rows.ministries} onChange={(event) => setRows({ ...rows, ministries: event.target.value })} /></label>
        <label style={labelStyle}>FAQs (question | answer)<textarea style={textareaStyle} value={rows.faqs} onChange={(event) => setRows({ ...rows, faqs: event.target.value })} /></label>
        <label style={labelStyle}>Core values (title | description | icon)<textarea style={textareaStyle} value={rows.coreValues} onChange={(event) => setRows({ ...rows, coreValues: event.target.value })} /></label>
        <label style={labelStyle}>Statement of faith (topic | belief)<textarea style={textareaStyle} value={rows.statementOfFaith} onChange={(event) => setRows({ ...rows, statementOfFaith: event.target.value })} /></label>
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

    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button type="submit" className="ch-btn ch-btn-primary" disabled={busy}>{busy ? "Saving…" : "Save website settings"}</button>
      <a className="ch-btn ch-btn-outline" href="/" target="_blank" rel="noreferrer">Preview public site</a>
    </div>
  </form>;
}
