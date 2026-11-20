import type { CSSProperties, ReactNode } from "react";
import { Container, Grid, SiteNavigation } from "@bazion/ui";
import { getPublicWebsiteNavigation } from "@bazion/website-contracts";
import { isSmeEnquiryCollectionAvailable, isSmeWebsitePageEnabled, type SmeWebsiteTemplateConfig } from "./config.js";
import { SmeContactForm } from "./contact-form.js";

export function SmeWebsiteShell({
  config,
  currentPath = "/",
  children,
}: {
  config: SmeWebsiteTemplateConfig;
  currentPath?: string;
  children: ReactNode;
}) {
  const contactPage = config.website.pages.find((page) => page.id === "contact" && page.enabled);
  const navigation = getPublicWebsiteNavigation(config.website.navigation, config.website.pages);
  const theme = {
    "--bw-color-brand": config.website.branding.primaryColor,
    "--bw-color-brand-hover": config.website.branding.secondaryColor,
    "--bw-color-accent": config.website.branding.accentColor,
    "--bw-color-accent-hover": config.website.branding.secondaryColor,
  } as CSSProperties;

  return (
    <div className="sme-website" style={theme}>
      <SiteNavigation
        brandName={config.business.name}
        {...(config.website.branding.logoUrl ? { logoUrl: config.website.branding.logoUrl } : {})}
        currentPath={currentPath}
        links={navigation}
        primaryAction={contactPage ? { label: "Contact us", href: contactPage.path } : null}
      />
      {children}
      <footer className="sme-site-footer">
        <Container>
          <div>
            <strong>{config.business.name}</strong>
            {config.business.tagline && <p>{config.business.tagline}</p>}
          </div>
          <div className="sme-site-footer-contact">
            {config.business.contact.email && <a href={`mailto:${config.business.contact.email}`}>{config.business.contact.email}</a>}
            {config.business.contact.telephone && <a href={`tel:${config.business.contact.telephone}`}>{config.business.contact.telephone}</a>}
            {config.business.contact.address && <span>{config.business.contact.address}</span>}
            {config.business.privacyNotice && <a href="/privacy">Privacy notice</a>}
          </div>
        </Container>
      </footer>
    </div>
  );
}

export function SmeHomePage({ config }: { config: SmeWebsiteTemplateConfig }) {
  const page = config.website.pages.find((candidate) => candidate.id === "home" && candidate.path === "/")!;
  return <SmeConfiguredPage config={config} page={page} />;
}

export function SmeAboutPage({ config }: { config: SmeWebsiteTemplateConfig }) {
  return (
    <main id="main-content">
      <section className="bw-section">
        <Container>
          <p className="sme-eyebrow">About our business</p>
          <h1>{config.business.name}</h1>
          <p className="sme-page-intro">{config.business.introduction}</p>
          <div className="sme-prose">{config.business.about.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
        </Container>
      </section>
    </main>
  );
}

export function SmeServicesPage({ config }: { config: SmeWebsiteTemplateConfig }) {
  const hasContactPage = isSmeWebsitePageEnabled(config, "contact");
  return (
    <main id="main-content">
      <section className="bw-section">
        <Container>
          <p className="sme-eyebrow">Our services</p>
          <h1>How we can help</h1>
          <Grid columns="auto" className="sme-services-grid">
            {config.business.services.map((service) => (
              <article className="sme-service-card" key={service.id}>
                <h2>{service.name}</h2>
                <p>{service.description}</p>
                {hasContactPage && <a href="/contact">Ask about this service</a>}
              </article>
            ))}
          </Grid>
        </Container>
      </section>
    </main>
  );
}

export function SmeContactPage({ config, endpoint, privacyNoticeHref = "/privacy", formsLeadsEnabled = false }: {
  config: SmeWebsiteTemplateConfig;
  endpoint?: string;
  privacyNoticeHref?: string;
  formsLeadsEnabled?: boolean;
}) {
  const canCollectEnquiries = isSmeEnquiryCollectionAvailable(config, formsLeadsEnabled);

  return (
    <main id="main-content">
      <section className="bw-section">
        <Container>
          <p className="sme-eyebrow">Contact</p>
          <h1>Tell us what you need</h1>
          <p className="sme-page-intro">Send a message and our team will get back to you.</p>
          <Grid columns="two" className="sme-contact-grid">
            <aside className="sme-contact-details" aria-label="Business contact details">
              {config.business.contact.email && <p><strong>Email</strong><br /><a href={`mailto:${config.business.contact.email}`}>{config.business.contact.email}</a></p>}
              {config.business.contact.telephone && <p><strong>Telephone</strong><br /><a href={`tel:${config.business.contact.telephone}`}>{config.business.contact.telephone}</a></p>}
              {config.business.contact.address && <p><strong>Address</strong><br />{config.business.contact.address}</p>}
            </aside>
            {canCollectEnquiries
              ? <SmeContactForm
                  {...(endpoint ? { endpoint } : {})}
                  privacyNoticeHref={privacyNoticeHref}
                  privacyNoticeVersion={config.business.privacyNoticeVersion}
                />
              : <p className="sme-contact-unavailable" role="status">Enquiries are temporarily unavailable. Please contact the business using the details provided.</p>}
          </Grid>
        </Container>
      </section>
    </main>
  );
}

export function SmePrivacyPage({ config }: { config: SmeWebsiteTemplateConfig }) {
  return (
    <main id="main-content">
      <section className="bw-section">
        <Container>
          <p className="sme-eyebrow">Privacy</p>
          <h1>Privacy notice</h1>
          {config.business.privacyNotice
            ? <div className="sme-prose">{config.business.privacyNotice.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            : <p className="sme-contact-unavailable" role="status">This business has not published its privacy notice yet.</p>}
        </Container>
      </section>
    </main>
  );
}

/** Renders a configured non-core page from the same live template configuration used by navigation. */
export function SmeConfiguredPage({ config, page, formsLeadsEnabled = false }: {
  config: SmeWebsiteTemplateConfig;
  page: SmeWebsiteTemplateConfig["website"]["pages"][number];
  formsLeadsEnabled?: boolean;
}) {
  const sections = new Set(page.sections);
  const showOfferings = sections.has("feature-list") || sections.has("card-grid");
  const hasContactPage = isSmeWebsitePageEnabled(config, "contact");
  const canCollectEnquiries = isSmeEnquiryCollectionAvailable(config, formsLeadsEnabled);

  return (
    <main id="main-content">
      {sections.has("hero") && (
        <section className="sme-home-hero">
          <Container>
            {config.business.tagline && <p className="sme-eyebrow">{config.business.tagline}</p>}
            <h1>{page.title}</h1>
            <p className="sme-home-intro">{config.business.introduction}</p>
          </Container>
        </section>
      )}
      {sections.has("text") && (
        <section className="bw-section">
          <Container>
            {!sections.has("hero") && <h1>{page.title}</h1>}
            <div className="sme-prose">{config.business.about.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
          </Container>
        </section>
      )}
      {showOfferings && (
        <section className="bw-section">
          <Container>
            <div className="sme-section-heading">
              <p className="sme-eyebrow">{config.business.name}</p>
              <h2>{page.title}</h2>
            </div>
            <Grid columns="auto" className="sme-services-grid">
              {config.business.services.map((service) => (
                <article className="sme-service-card" key={service.id}>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  {hasContactPage && <a href="/contact">Contact us</a>}
                </article>
              ))}
            </Grid>
          </Container>
        </section>
      )}
      {sections.has("faq") && (
        <section className="bw-section">
          <Container>
            <h2>Questions about {config.business.name}?</h2>
            {config.business.content.faqs.length
              ? <div className="sme-faq-list">{config.business.content.faqs.map((faq, index) => <details key={`faq-${index}`}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div>
              : <p className="sme-page-intro">Contact the team for details about services, availability, and next steps.</p>}
            {hasContactPage && <a className="sme-action" href="/contact">Contact us</a>}
          </Container>
        </section>
      )}
      {sections.has("testimonials") && config.business.content.testimonials.length > 0 && (
        <section className="bw-section"><Container><div className="sme-section-heading"><p className="sme-eyebrow">Client stories</p><h2>What people say</h2></div><Grid columns="auto">{config.business.content.testimonials.map((item) => <figure className="sme-service-card" key={item.id}><blockquote>{item.quote}</blockquote><figcaption><strong>{item.author}</strong>{item.role && <span> · {item.role}</span>}</figcaption></figure>)}</Grid></Container></section>
      )}
      {sections.has("gallery") && config.business.content.gallery.length > 0 && (
        <section className="bw-section"><Container><div className="sme-section-heading"><p className="sme-eyebrow">Gallery</p><h2>{page.title}</h2></div><Grid columns="auto">{config.business.content.gallery.map((item) => <figure className="sme-service-card" key={item.id}><img src={item.imageUrl} alt={item.alt} loading="lazy" style={{ width: "100%", height: "auto", borderRadius: 8 }} />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</Grid></Container></section>
      )}
      {sections.has("events") && config.business.content.events.length > 0 && (
        <section className="bw-section"><Container><div className="sme-section-heading"><p className="sme-eyebrow">Events</p><h2>{page.title}</h2></div><Grid columns="auto">{config.business.content.events.map((item) => <article className="sme-service-card" key={item.id}><p>{item.startsAt}</p><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}{item.href && <a href={item.href}>Event details</a>}</article>)}</Grid></Container></section>
      )}
      {sections.has("media") && config.business.content.media.length > 0 && (
        <section className="bw-section"><Container><div className="sme-section-heading"><p className="sme-eyebrow">Media</p><h2>{page.title}</h2></div><Grid columns="auto">{config.business.content.media.map((item) => <article className="sme-service-card" key={item.id}><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<a href={item.href} target={item.href.startsWith("/") ? undefined : "_blank"} rel={item.href.startsWith("/") ? undefined : "noopener noreferrer"}>Open media</a></article>)}</Grid></Container></section>
      )}
      {sections.has("contact-form") && (
        <section className="bw-section">
          <Container>
            <h2>Contact us</h2>
            {canCollectEnquiries
              ? <SmeContactForm privacyNoticeHref="/privacy" privacyNoticeVersion={config.business.privacyNoticeVersion} />
              : <p className="sme-contact-unavailable" role="status">Enquiries are unavailable until this tenant enables enquiry capture and publishes its privacy notice.</p>}
          </Container>
        </section>
      )}
      {sections.has("call-to-action") && hasContactPage && (
        <section className="bw-section">
          <Container><a className="sme-action" href="/contact">Talk to our team</a></Container>
        </section>
      )}
      {!page.sections.length && (
        <section className="bw-section"><Container><h1>{page.title}</h1><p className="sme-page-intro">{config.business.introduction}</p></Container></section>
      )}
    </main>
  );
}

