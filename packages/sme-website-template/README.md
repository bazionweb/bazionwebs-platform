# `@bazion/sme-website-template`

Reusable small-business website pages built on the shared website configuration contract and `@bazion/ui`. This package provides home, about, services, contact and privacy page components, tenant-resolved navigation, shared SEO metadata, and an enquiry form with consent and a honeypot field.

The contact form posts to `/v1/public/site/enquiries` by default. A consuming application can configure a different same-site path, but cannot direct personal information to another origin. Keep the form disabled until the tenant has published a privacy notice and the matching version is configured in the tenant's forms policy through the API. The API assigns tenant identity, consent timestamp, notice version and retention deadline; it verifies the submitted version against that published tenant policy.

Import `@bazion/ui/tokens.css`, `@bazion/ui/primitives.css`, `@bazion/ui/navigation.css`, and `@bazion/sme-website-template/theme.css` once in the consuming app's root layout. Do not import the Church/Ministry stylesheet for this template.
