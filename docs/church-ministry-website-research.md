# Church and ministry website feature map

This review separates the public website visitors need from the internal church operations product. The current repository already had events and registrations, sermons, giving, contact and prayer intake, basic ministry administration, and a reference storefront. The missing pieces with the highest public impact were visitor logistics, tenant editable website content, a usable ministry list and FAQ, a real media gallery, functioning consent forms, and a complete campaign publishing path.

## Website feature map

| Visitor need | Template support | Notes |
|---|---|---|
| Understand the ministry and its beliefs | Profile, vision, mission, outreach, leadership, values, and statement of faith | Content comes from the selected tenant or its published settings. |
| Plan a first visit | Service times, locations, map links, children, accessibility, parking and arrival notes | No times or location are invented when a ministry has not published them. |
| Find a group and get answers | Ministry cards and frequently asked questions | Content is tenant editable. |
| Join in person or online | Event calendar and registration; optional livestream link | Event signup requires a privacy acknowledgement. |
| Watch or study a message | Sermon library, detail pages, video embeds, scripture reference and study notes | Event and video detail pages add structured data when sufficient factual data is present. |
| Give with clarity | Campaigns, M-Pesa online request, manual payment instructions, suggested amounts and confirmation status | A contribution is counted only after provider confirmation. Per-tenant merchant accounts and callback recovery are still platform work. |
| Contact, request prayer or share a testimony | Contact and private prayer intake | Separate purpose text and consent, visible errors, and success only after the API confirms receipt. Prayer records are treated as sensitive. |
| Follow ministry activity | Social links, optional email opt-in and curated gallery | The email intake stores consent; an outbound newsletter delivery/unsubscribe service is not yet connected. Gallery images use existing HTTPS or site assets; upload storage is not included. |
| Find legal and search information | Privacy and terms pages, robots and sitemap | Search metadata and sitemap origins resolve for the incoming tenant domain; sitemap includes published sermon and non-cancelled event detail URLs. Event structured data is emitted only for upcoming events with date and physical location. |
| Manage the public site | Signed-in profile and website settings editor, sermons, events and giving campaigns | Settings include brand colors, hero, contact, service logistics, ministries, FAQs, leaders, gallery URLs, giving instructions and search description. |

## Research and implementation guidance

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) is the current W3C accessibility recommendation. This implementation adds visible focus, reduced-motion handling, a skip link, clearer form labels and status messages, and larger interactive controls. Theme colors are checked for a 4.5:1 contrast ratio against white.
- The [Office of the Data Protection Commissioner FAQ](https://www.odpc.go.ke/faqs/) identifies conscience and belief as sensitive personal data and says religious/faith-based institutions are among sectors subject to mandatory registration. The [data subject rights page](https://www.odpc.go.ke/rights-of-a-data-subject/index.html) covers notice, access, correction, objection, and erasure rights. Prayer form language and privacy copy now identify the religiously sensitive nature of prayer requests and provide a contact path for requests. Each ministry still needs to confirm its controller identity, lawful basis, registration, retention schedule, processor arrangements, and operational rights process.
- [Google's event structured data documentation](https://developers.google.com/search/docs/appearance/structured-data/event) expects each real event to have a page with accurate dates and place details. The template avoids generating event markup when those facts are incomplete and publishes detail URLs through the sitemap. Google's event rich results have eligibility constraints by region; this template does not promise rich-result display.
- [Next.js metadata and sitemap guidance](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) recommends page metadata and sitemap/robots files. Tenant title, description and hero image settings now feed server-rendered Open Graph/Twitter metadata; event and sermon details get item metadata, and sitemap/robots origins resolve for the incoming tenant domain.
- [Core Web Vitals guidance](https://web.dev/articles/vitals) treats loading, responsiveness and layout stability as user-facing quality signals. The redesigned shared church UI uses responsive grids, reduced motion, and no fabricated hero/event image when content is missing; runtime performance still depends on image hosting and deployment.

## Deliberate boundaries

This is a reusable public ministry website template and a starter content editor, not a complete church-management system. Public pages still load tenant content after hydration; server-rendered metadata is available, but server-rendered page content would improve first paint and crawlability. The repo still needs media upload/storage, a full page builder, sermon editing and content scheduling, newsletter delivery and unsubscribe handling, campaign financial reconciliation, tenant-specific M-Pesa credentials and missing-callback operations. Membership, households, attendance, volunteer scheduling, pastoral workflows, finance roles, audit coverage, retention automation, and ministry-specific legal review are separate product work.
