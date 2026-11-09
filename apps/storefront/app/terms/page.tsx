"use client";

import {
  ChurchNav,
  ChurchFooter,
  PageHero,
} from "@bazion/ui";
import { useMinistrySite } from "../../lib/use-ministry-site";

export default function TermsPage() {
  const site = useMinistrySite();
  return (
    <>
      <ChurchNav
        ministryName={site.ministryName}
        logoUrl={site.branding.logoUrl}
        currentPath="/terms"
        giveHref="/give"
      />

      <main id="main-content">
        <PageHero
          eyebrow="LEGAL & USAGE"
          title="Terms of Use"
          subtitle={`Terms governing the use of the ${site.ministryName} website and digital services.`}
        />

        <article className="ch-section">
          <div className="ch-container" style={{ maxWidth: "800px" }}>
            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>1. Acceptance of Terms</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              By accessing and using this website, you agree to comply with and be bound by these
              Terms of Use and all applicable laws and regulations in Kenya and your local jurisdiction.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>2. Ministry Media & Content</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              All sermons, audio messages, video recordings, photographs, and logos published on this
              website are the intellectual property of the ministry or its respective rights holders. You
              are encouraged to share links and sermon videos for personal spiritual edification and
              evangelism, provided proper attribution is maintained and content is not sold or modified.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>3. Voluntary Donations</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              All contributions and tithes given through M-Pesa or bank remittances are voluntary
              freewill offerings given to support the religious, evangelistic, and charitable mission
              activities of the ministry.
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
