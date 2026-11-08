import {
  ChurchNav,
  ChurchFooter,
  PageHero,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../../templates/global-mission.config";

export default function PrivacyPolicyPage() {
  return (
    <>
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/privacy"
        giveHref="/give"
      />

      <main>
        <PageHero
          eyebrow="LEGAL & DATA PROTECTION"
          title="Privacy Policy"
          subtitle="How Global Mission for Christ International protects your personal information and prayer requests."
        />

        <article className="ch-section">
          <div className="ch-container" style={{ maxWidth: "800px" }}>
            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>1. Information We Collect</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              When you submit a contact enquiry, prayer request, event registration, or donate to the
              ministry, we collect only necessary identifying details such as your name, telephone
              number, email address, and optional prayer request details.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>2. Confidentiality of Prayer Requests</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              We treat prayer requests with the highest level of pastoral confidentiality. Your
              spiritual burdens are shared strictly with our verified pastoral intercession team and
              are never published, monetized, or shared with third parties.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>3. Financial & Donation Data</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              Mobile money transactions (M-Pesa) are processed securely through regulated payment
              gateways (Safaricom Daraja and Equity Bank). We never store PIN numbers, mobile money
              passwords, or sensitive banking credentials on our servers.
            </p>

            <h2 style={{ color: "var(--church-primary)", marginBottom: "16px" }}>4. Contact Us</h2>
            <p style={{ lineHeight: 1.8, color: "var(--church-text)", marginBottom: "24px" }}>
              If you have any questions regarding your personal information, please contact us at{" "}
              <a href={`mailto:${globalMissionConfig.contact.email}`} style={{ color: "var(--church-secondary)" }}>
                {globalMissionConfig.contact.email}
              </a>.
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
