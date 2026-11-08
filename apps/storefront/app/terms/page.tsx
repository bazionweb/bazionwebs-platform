import {
  ChurchNav,
  ChurchFooter,
  PageHero,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";

export default function TermsPage() {
  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/terms"
        giveHref="/give"
      />

      <main>
        <PageHero
          eyebrow="LEGAL & USAGE"
          title="Terms of Use"
          subtitle="Terms governing the use of the Global Mission for Christ International website and digital services."
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
              website are the intellectual property of Global Mission for Christ International. You
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
        ministryName={globalMissionConfig.ministryName}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
      />
    </>
  );
}
