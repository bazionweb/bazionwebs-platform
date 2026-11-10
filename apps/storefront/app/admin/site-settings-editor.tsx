"use client";

import { useEffect, useState } from "react";
import {
  churchPublicSiteSettingsSchema,
  type ChurchPublicSiteSettings,
  type ChurchSiteSettingsInput,
} from "@bazion/church-ministry-contracts";
import { apiErrorMessage } from "../../lib/api-error";
import { MediaUploadField } from "./media-upload-field";

type SiteProfile = ChurchSiteSettingsInput["profile"];
type RowName = "serviceTimes" | "locations" | "ministries" | "faqs" | "coreValues" | "statementOfFaith";

function parseRows<T>(value: string, convert: (parts: string[]) => T | null): T[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    const parts = line.split("|").map((part) => part.trim());
    const item = convert(parts);
    if (!item) throw new Error("Each non-empty content line must include its required values separated by |.");
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
        setSettings(churchPublicSiteSettingsSchema.parse(result.settings));
        setRows({
          serviceTimes: rowsText(result.settings, "serviceTimes"),
          locations: rowsText(result.settings, "locations"),
          ministries: rowsText(result.settings, "ministries"),
          faqs: rowsText(result.settings, "faqs"),
          coreValues: rowsText(result.settings, "coreValues"),
          statementOfFaith: rowsText(result.settings, "statementOfFaith"),
        });
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load website settings."); })
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
        branding: { ...settings.branding, heroImageUrl: settings.branding.heroImageUrl?.trim() || undefined },
        online: { ...settings.online, liveStreamUrl: settings.online.liveStreamUrl?.trim() || undefined },
        serviceTimes: parseRows(rows.serviceTimes, (parts) => parts.length >= 3 && parts[0] && parts[1] && parts[2]
          ? { label: parts[0], day: parts[1], time: parts[2], note: parts[3] || undefined } : null),
        locations: parseRows(rows.locations, (parts) => parts.length >= 2 && parts[0] && parts[1]
          ? { name: parts[0], address: parts[1], mapUrl: parts[2] || undefined } : null),
        ministries: parseRows(rows.ministries, (parts) => parts.length >= 2 && parts[0] && parts[1]
          ? { title: parts[0], description: parts[1], audience: parts[2] || undefined } : null),
        faqs: parseRows(rows.faqs, (parts) => { const [question, answer] = splitPair(parts.join(" | ")); return question && answer ? { question, answer } : null; }),
        coreValues: parseRows(rows.coreValues, (parts) => parts.length >= 2 && parts[0] && parts[1]
          ? { title: parts[0], description: parts[1], icon: parts[2] || undefined } : null),
        statementOfFaith: parseRows(rows.statementOfFaith, (parts) => { const [topic, belief] = splitPair(parts.join(" | ")); return topic && belief ? { topic, belief } : null; }),
        galleryImages: settings.galleryImages.filter((item) => item.imageUrl.trim() || item.alt.trim() || item.caption?.trim()),
        leadership: settings.leadership.filter((item) => item.name.trim() || item.role.trim() || item.bio?.trim() || item.photoUrl?.trim()),
        giving: { ...settings.giving, suggestedAmounts: settings.giving.suggestedAmounts },
      });
      await requestJson("/v1/admin/church/site-settings", {
        method: "PUT",
        body: JSON.stringify({ profile, settings: parsedSettings }),
      });
      setSettings(parsedSettings);
      setNotice("Website settings saved. Refresh the public site or preview tab to see the changes.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Website settings could not be saved.";
      setError(message.startsWith("[") ? "Check required fields and links. Each content row uses the format shown below its field." : message);
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
