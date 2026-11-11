import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  defaultSmeWebsiteTemplateConfig,
  smeWebsiteTemplateConfigSchema,
} from "./config.js";
import { SmeContactPage, SmeHomePage, SmeWebsiteShell } from "./pages.js";

function tenantConfig(name: string, primaryColor: string, navigation: Array<{ id: string; label: string; href: string }>) {
  return smeWebsiteTemplateConfigSchema.parse({
    website: { branding: { primaryColor }, navigation },
    business: {
      ...defaultSmeWebsiteTemplateConfig.business,
      name,
      introduction: `${name} provides trusted services for local customers.`,
      privacyNotice: "We use your contact details only to respond and remove them after the stated retention period.",
    },
  });
}

describe("SME website rendered pages", () => {
  it("renders separate tenant branding and content through the same page components", () => {
    const harbour = tenantConfig("Harbour Repairs", "#1d4ed8", [
      { id: "home", label: "Home", href: "/" },
      { id: "services", label: "Repairs", href: "/services" },
      { id: "contact", label: "Get a quote", href: "/contact" },
    ]);
    const maji = tenantConfig("Maji Works", "#166534", [
      { id: "home", label: "Home", href: "/" },
      { id: "about", label: "Our story", href: "/about" },
      { id: "contact", label: "Visit us", href: "/contact" },
    ]);
    const render = (config: typeof harbour) => renderToStaticMarkup(
      <SmeWebsiteShell config={config}>
        <SmeHomePage config={config} />
      </SmeWebsiteShell>,
    );

    const harbourMarkup = render(harbour);
    const majiMarkup = render(maji);

    expect(harbourMarkup).toContain("Harbour Repairs");
    expect(harbourMarkup).toContain("--bw-color-brand:#1d4ed8");
    expect(harbourMarkup).toContain(">Repairs</a>");
    expect(harbourMarkup).toContain(">Get a quote</a>");
    expect(harbourMarkup).toContain("href=\"#main-content\"");
    expect(harbourMarkup).toContain("aria-label=\"Main navigation\"");
    expect(majiMarkup).toContain("Maji Works");
    expect(majiMarkup).toContain("--bw-color-brand:#166534");
    expect(majiMarkup).toContain(">Our story</a>");
    expect(majiMarkup).toContain(">Visit us</a>");
    expect(majiMarkup).not.toContain("Harbour Repairs");
  });

  it("renders a labelled consent form only for enabled tenants with a published notice", () => {
    const configured = tenantConfig("Harbour Repairs", "#1d4ed8");
    const withoutNotice = smeWebsiteTemplateConfigSchema.parse({
      business: defaultSmeWebsiteTemplateConfig.business,
    });
    const enabledMarkup = renderToStaticMarkup(
      <SmeContactPage config={configured} formsLeadsEnabled />,
    );
    const disabledMarkup = renderToStaticMarkup(
      <SmeContactPage config={configured} formsLeadsEnabled={false} />,
    );
    const noNoticeMarkup = renderToStaticMarkup(
      <SmeContactPage config={withoutNotice} formsLeadsEnabled />,
    );

    expect(enabledMarkup).toContain('name="fullName"');
    expect(enabledMarkup).toContain('name="privacyConsent"');
    expect(enabledMarkup).toContain("Read the <a href=\"/privacy\">privacy notice</a>");
    expect(enabledMarkup).toMatch(/<label[^>]+for=/);
    expect(disabledMarkup).not.toContain('class="sme-contact-form"');
    expect(disabledMarkup).toContain('role="status"');
    expect(noNoticeMarkup).not.toContain('class="sme-contact-form"');
  });
});
