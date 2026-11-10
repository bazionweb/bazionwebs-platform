"use client";

import {
  ChurchNav,
  ChurchFooter,
  PageHero,
} from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function PrivacyPolicyPage() {
  const site = useMinistrySite();
  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        links={site.navigation}
        currentPath="/privacy"
        giveHref={site.pages.some((page) => page.id === "giving" && page.enabled) ? "/give" : null}
      />

      <main id="main-content">
        <PageHero
          eyebrow="LEGAL & DATA PROTECTION"
          title="Privacy Policy"
          subtitle={`How ${site.ministryName} handles personal information submitted through this site.`}
        />

        <article className="ch-section">
          <div className="ch-container" style={{ maxWidth: "800px" }}>
            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>1. Information We Collect</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              When you submit a contact enquiry, prayer request, event registration, or donate to the
              ministry, we collect only necessary identifying details such as your name, telephone
              number, email address, and optional prayer request details.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>2. Who handles your information</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              {site.ministryName} receives and decides how to use information sent through this site.
              Bazion Web Platform processes it to operate the website and ministry tools. For questions,
              access, correction, deletion, or withdrawal requests, contact the ministry at{" "}
              {site.contact.email ? <a href={`mailto:${site.contact.email}`} style={{ color: "var(--church-secondary)" }}>{site.contact.email}</a> : <a href="/contact" style={{ color: "var(--church-secondary)" }}>the contact page</a>}.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>3. Prayer requests</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              A prayer request can reveal religious belief and other sensitive information. It is not
              displayed publicly. Access is limited to authorized ministry owners and administrators;
              only include details you want to share with that team. Ask the ministry to correct or
              remove a request you previously submitted.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>4. How information is used and shared</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              Contact details are used to respond to your enquiry, event details to manage your
              registration, prayer details for the prayer request you chose to share, and newsletter
              addresses only when you opt in. Website hosting and service providers process information
              needed to operate these features. We do not display enquiries, registrations, donations,
              or prayer requests publicly.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>5. Financial and donation data</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              When online M-Pesa giving is enabled, the site sends a payment request through the
              configured Safaricom Daraja integration. The site does not request or store M-Pesa PINs.
              Direct Paybill transfers are initiated by the donor and are not automatically verified
              by this site. Donation and transaction records may need to be kept for financial
              reconciliation or other legal obligations, even when other submitted personal details
              can be removed.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>6. Retention and security</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              The ministry should keep information only as long as needed for the purpose it was
              collected, then securely remove or anonymize it, subject to financial recordkeeping
              duties. Access to private requests and enquiries is restricted to authorized accounts.
              Contact the ministry if you need its retention period for a particular record.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>7. Your choices and contact</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              You may ask the ministry for access to, correction of, or deletion of information you
              submitted, or withdraw consent for future processing where consent is the basis. You may
              also raise a concern with the <a href="https://www.odpc.go.ke/rights-of-a-data-subject/index.html" target="_blank" rel="noopener noreferrer" style={{ color: "var(--church-secondary)" }}>Office of the Data Protection Commissioner</a>. Contact the ministry at{" "}
              {site.contact.email ? <a href={`mailto:${site.contact.email}`} style={{ color: "var(--church-secondary)" }}>{site.contact.email}</a> : <a href="/contact" style={{ color: "var(--church-secondary)" }}>the contact page</a>}.
            </p>
          </div>
        </article>
      </main>

      <ChurchFooter
        ministryName={site.ministryName}
        tagline={site.tagline}
        phoneNumbers={site.contact.phones}
        email={site.contact.email}
        address={site.contact.address}
      />
    </>
  );
}
