import {
  WEBSITE_CONFIGURATION_VERSION,
  WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
  websiteConfigurationSchema,
  type WebsiteConfiguration,
  type WebsiteNavigation,
  type WebsitePages,
} from "./index.js";

export type WhiteLabelPackageId =
  | "sme-website"
  | "ecommerce"
  | "professional-services"
  | "clinic-management"
  | "school-education"
  | "ngo-membership"
  | "startup-saas"
  | "enterprise-erp"
  | "church-ministry";

export type ByowFramework =
  | "nextjs"
  | "react-vite"
  | "astro"
  | "remix"
  | "wordpress"
  | "static"
  | "custom-docker";

export type WhiteLabelPaletteId =
  | "corporate-slate"
  | "emerald-growth"
  | "medical-teal"
  | "maroon-gold"
  | "forest-bronze"
  | "royal-navy"
  | "living-waters"
  | "sanctuary-charcoal";

export interface UniversalThemePalette {
  id: WhiteLabelPaletteId;
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
}

export const universalThemePalettes: readonly UniversalThemePalette[] = [
  {
    id: "corporate-slate",
    name: "Corporate Slate & Indigo",
    description: "Clean executive navy-slate and teal accent for B2B firms, agencies & SMEs.",
    primaryColor: "#1E293B",
    secondaryColor: "#334155",
    accentColor: "#0F766E",
    surfaceColor: "#F8FAFC",
  },
  {
    id: "emerald-growth",
    name: "Emerald Commerce & Amber",
    description: "High-trust emerald green with warm gold-bronze CTAs for retail, fintech & growth brands.",
    primaryColor: "#065F46",
    secondaryColor: "#047857",
    accentColor: "#92400E",
    surfaceColor: "#ECFDF5",
  },
  {
    id: "medical-teal",
    name: "Clinical Teal & Cobalt",
    description: "Calm healthcare teal and authoritative cobalt blue for clinics, schools & institutions.",
    primaryColor: "#115E59",
    secondaryColor: "#0F766E",
    accentColor: "#1D4ED8",
    surfaceColor: "#F0FDFA",
  },
  {
    id: "maroon-gold",
    name: "Heritage Maroon & Gold",
    description: "Deep maroon burgundy, warm amber-gold contrast, and warm cream surfaces.",
    primaryColor: "#4A1110",
    secondaryColor: "#6B1A18",
    accentColor: "#B45E14",
    surfaceColor: "#F8F1E5",
  },
  {
    id: "forest-bronze",
    name: "Sanctuary Forest & Bronze",
    description: "Deep pine green, reverent sage, and warm bronze accents.",
    primaryColor: "#193A31",
    secondaryColor: "#315E50",
    accentColor: "#8B5B29",
    surfaceColor: "#FBF9F5",
  },
  {
    id: "royal-navy",
    name: "Royal Navy & Amber",
    description: "Majestic deep navy blue and warm amber highlights for institutions & leadership hubs.",
    primaryColor: "#0F2B48",
    secondaryColor: "#1E4976",
    accentColor: "#A16207",
    surfaceColor: "#F8FAFC",
  },
  {
    id: "living-waters",
    name: "Living Waters Teal & Ochre",
    description: "Vibrant ocean teal, deep marine tones, and warm terracotta ochre.",
    primaryColor: "#0F4C5C",
    secondaryColor: "#136F63",
    accentColor: "#C25E00",
    surfaceColor: "#F4F8F8",
  },
  {
    id: "sanctuary-charcoal",
    name: "Minimal Charcoal & Burgundy",
    description: "Contemporary obsidian charcoal and rich wine burgundy accents.",
    primaryColor: "#18181B",
    secondaryColor: "#3F3F46",
    accentColor: "#881337",
    surfaceColor: "#FAFAFA",
  },
];

export interface PackageTemplateOffering {
  id: string;
  name: string;
  description: string;
  category?: string;
}

export interface PackageTemplateDescriptor {
  id: string;
  name: string;
  tagline: string;
  defaultPalette: WhiteLabelPaletteId;
  defaultNavigation: WebsiteNavigation;
  defaultPages: WebsitePages;
  defaultOfferings: PackageTemplateOffering[];
  features: string[];
}

export interface WhiteLabelPackageDescriptor {
  packageId: WhiteLabelPackageId;
  name: string;
  category: string;
  tagline: string;
  description: string;
  defaultPalette: WhiteLabelPaletteId;
  assignableModules: string[];
  templates: PackageTemplateDescriptor[];
}

function buildStandardPages(servicesTitle: string, extraPages: WebsitePages = []): WebsitePages {
  return [
    { id: "home", path: "/", title: "Home", enabled: true, sections: ["hero", "text", "feature-list", "call-to-action"] },
    { id: "about", path: "/about", title: "About Us", enabled: true, sections: ["hero", "text", "feature-list"] },
    { id: "services", path: "/services", title: servicesTitle, enabled: true, sections: ["hero", "card-grid", "call-to-action"] },
    ...extraPages,
    { id: "contact", path: "/contact", title: "Contact", enabled: true, sections: ["hero", "text", "contact-form"] },
    { id: "privacy", path: "/privacy", title: "Privacy Notice", enabled: true, sections: ["text"] },
  ];
}

export const platformWhiteLabelPackageCatalog: readonly WhiteLabelPackageDescriptor[] = [
  {
    packageId: "sme-website",
    name: "SME & Business Website",
    category: "Commercial & Corporate",
    tagline: "Multi-page company site with services catalogue, lead forms & SEO defaults",
    description: "White-labeled business website package backed by @bazion/sme-website-template and forms-leads capture.",
    defaultPalette: "corporate-slate",
    assignableModules: ["forms-leads", "media-storage", "analytics"],
    templates: [
      {
        id: "sme-corporate-authority",
        name: "Corporate & Authority Showcase",
        tagline: "Clean executive hero, company credentials, services grid & quote enquiry form",
        defaultPalette: "corporate-slate",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "about", label: "About", href: "/about" },
          { id: "services", label: "Services", href: "/services" },
          { id: "contact", label: "Contact", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Our Services"),
        defaultOfferings: [
          { id: "core-advisory", name: "Core Consultation & Delivery", description: "Tailored strategy, planning, and execution delivered to clear service-level milestones." },
          { id: "managed-support", name: "Ongoing Managed Support", description: "Dependable retainer support, reporting, and priority response for client operations." },
          { id: "custom-projects", name: "Custom Client Solutions", description: "End-to-end project implementation adapted to your team and budget requirements." },
        ],
        features: ["Responsive Hero & Value Props", "Services Showcase Grid", "Lead Capture & Privacy Consent", "SEO Meta Defaults"],
      },
      {
        id: "sme-local-services",
        name: "Local Service Business & Trades",
        tagline: "High-converting local trust layout with WhatsApp click-to-chat, service areas & FAQs",
        defaultPalette: "emerald-growth",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "services", label: "Services", href: "/services" },
          { id: "faq", label: "FAQ", href: "/faq" },
          { id: "contact", label: "Contact", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Services & Pricing", [
          { id: "faq", path: "/faq", title: "Frequently Asked Questions", enabled: true, sections: ["hero", "faq"] },
        ]),
        defaultOfferings: [
          { id: "on-site-assessment", name: "On-Site Inspection & Quote", description: "Transparent scoping visit and itemized proposal before work starts." },
          { id: "installation-service", name: "Standard Installation", description: "Certified installation backed by workmanship guarantee." },
          { id: "preventive-care", name: "Annual Maintenance Plan", description: "Scheduled servicing to keep equipment and premises running smoothly." },
        ],
        features: ["Quote Request Form", "FAQ Accordion", "Local Trust Badges"],
      },
    ],
  },
  {
    packageId: "ecommerce",
    name: "E-Commerce Storefront",
    category: "Retail & D2C",
    tagline: "Product catalogue, cart, M-Pesa/card checkout & collection storefront",
    description: "Full online store package wired to Bazion Commerce catalog, cart, order lifecycle, and mobile money.",
    defaultPalette: "emerald-growth",
    assignableModules: ["commerce", "media-storage", "analytics", "notifications"],
    templates: [
      {
        id: "ecommerce-modern-retail",
        name: "Modern Online Storefront",
        tagline: "Featured collections, fast search, product detail cards & seamless M-Pesa checkout",
        defaultPalette: "emerald-growth",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "shop", label: "Shop", href: "/shop" },
          { id: "about", label: "Our Story", href: "/about" },
          { id: "contact", label: "Contact", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Store Highlights", [
          { id: "shop", path: "/shop", title: "Shop Catalogue", enabled: true, sections: ["hero", "card-grid", "call-to-action"] },
        ]),
        defaultOfferings: [
          { id: "featured-arrivals", name: "Featured Collections", description: "Curated seasonal arrivals with transparent pricing and nationwide delivery." },
          { id: "bulk-wholesale", name: "Bulk & Corporate Orders", description: "Dedicated fulfillment pricing for recurring business buyers." },
          { id: "express-dispatch", name: "Same-Day Urban Dispatch", description: "Tracked courier delivery with instant SMS and email order confirmation." },
        ],
        features: ["Product Catalog & Cart", "M-Pesa & Online Checkout", "Order Confirmation Outbox"],
      },
      {
        id: "ecommerce-d2c-flagship",
        name: "D2C Brand & Catalogue Flagship",
        tagline: "Editorial product storytelling, customer reviews & multi-currency support",
        defaultPalette: "sanctuary-charcoal",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "collections", label: "Collections", href: "/collections" },
          { id: "about", label: "Brand", href: "/about" },
          { id: "contact", label: "Support", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Services", [
          { id: "collections", path: "/collections", title: "Collections", enabled: true, sections: ["hero", "gallery", "card-grid"] },
        ]),
        defaultOfferings: [
          { id: "signature-line", name: "Signature Collection", description: "Direct-to-consumer flagship products crafted with verified quality." },
          { id: "gift-bundles", name: "Curated Bundles", description: "Value packs designed for gifting and repeat household essentials." },
        ],
        features: ["Editorial Lookbook Grid", "Customer Reviews", "Promotional Announcements"],
      },
    ],
  },
  {
    packageId: "professional-services",
    name: "Professional Services & Booking",
    category: "Consulting, Legal & Agencies",
    tagline: "Practice credentials, consultation booking, case studies & client intake",
    description: "Built for law firms, accountants, consultants, salons, and agencies accepting booked appointments.",
    defaultPalette: "royal-navy",
    assignableModules: ["forms-leads", "media-storage", "analytics"],
    templates: [
      {
        id: "pro-advisory-practice",
        name: "Advisory & Legal Practice",
        tagline: "Partner bios, practice areas, client intake & consultation scheduler",
        defaultPalette: "royal-navy",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "services", label: "Practice Areas", href: "/services" },
          { id: "about", label: "Partners", href: "/about" },
          { id: "contact", label: "Book Consultation", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Practice Areas"),
        defaultOfferings: [
          { id: "strategic-advisory", name: "Strategic Advisory", description: "Executive counsel and structured diagnostics for growing organizations." },
          { id: "compliance-audit", name: "Compliance & Governance Review", description: "Regulatory readiness assessments and ongoing board reporting." },
          { id: "client-retainer", name: "Monthly Practice Retainer", description: "Dedicated advisory hours and prioritized document turnaround." },
        ],
        features: ["Partner & Team Showcase", "Practice Area Matrix", "Consultation Intake Form"],
      },
      {
        id: "pro-studio-booking",
        name: "Studio & Appointment Service",
        tagline: "Service menu, portfolio gallery & online slot reservation",
        defaultPalette: "corporate-slate",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "services", label: "Treatments & Services", href: "/services" },
          { id: "gallery", label: "Portfolio", href: "/gallery" },
          { id: "contact", label: "Book Now", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Service Menu", [
          { id: "gallery", path: "/gallery", title: "Portfolio Gallery", enabled: true, sections: ["hero", "gallery"] },
        ]),
        defaultOfferings: [
          { id: "signature-session", name: "Signature Consultation Session", description: "Personalized 60-minute session tailored to your exact objectives." },
          { id: "vip-package", name: "Complete Care Package", description: "Multi-session bundle with priority scheduling and follow-up." },
        ],
        features: ["Visual Portfolio Grid", "Clear Service Menu", "Appointment Enquiry Capture"],
      },
    ],
  },
  {
    packageId: "clinic-management",
    name: "Clinic & Healthcare Portal",
    category: "Healthcare & Wellness",
    tagline: "Department directory, specialist roster, patient intake & clinic hours",
    description: "Patient-centered clinic, dental, optical, and diagnostic center portal with booking & enquiry safety.",
    defaultPalette: "medical-teal",
    assignableModules: ["forms-leads", "media-storage", "notifications"],
    templates: [
      {
        id: "clinic-medical-center",
        name: "Outpatient Clinic & Medical Center",
        tagline: "Clinical departments, doctor profiles, insurance partners & triage contact",
        defaultPalette: "medical-teal",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "services", label: "Departments", href: "/services" },
          { id: "about", label: "Our Doctors", href: "/about" },
          { id: "contact", label: "Book Visit", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Clinical Departments"),
        defaultOfferings: [
          { id: "general-consultation", name: "Outpatient & Family Medicine", description: "Comprehensive primary care consultations with experienced clinicians." },
          { id: "lab-diagnostics", name: "Laboratory & Imaging", description: "Accurate same-day diagnostics and digital result reporting." },
          { id: "maternal-wellness", name: "Preventive Wellness & Screening", description: "Annual checkups, immunizations, and chronic care monitoring." },
        ],
        features: ["Department Directory", "Clinician Roster", "Appointment Request Form"],
      },
    ],
  },
  {
    packageId: "school-education",
    name: "School & Education Portal",
    category: "Academies, Colleges & Training",
    tagline: "Academic programs, admissions intake, term calendar & parent notices",
    description: "Clean multi-page campus portal for academies, colleges, and training institutes.",
    defaultPalette: "royal-navy",
    assignableModules: ["forms-leads", "media-storage", "notifications", "analytics"],
    templates: [
      {
        id: "school-academy-heritage",
        name: "Academy & Admissions Portal",
        tagline: "Curriculum overview, campus facilities, term events & admissions enquiry",
        defaultPalette: "royal-navy",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "services", label: "Academics", href: "/services" },
          { id: "events", label: "Term Calendar", href: "/events" },
          { id: "contact", label: "Admissions", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Academic Programs", [
          { id: "events", path: "/events", title: "Term Calendar & Events", enabled: true, sections: ["hero", "events"] },
        ]),
        defaultOfferings: [
          { id: "core-curriculum", name: "Holistic Academic Curriculum", description: "Structured STEM, humanities, and mentorship fostering measurable excellence." },
          { id: "cocurricular", name: "Clubs, Sports & Leadership", description: "Robotics, debate, music, and athletics developing well-rounded learners." },
          { id: "admissions-tours", name: "Campus Tours & Enrollment", description: "Guided campus visits and transparent semester fee schedules." },
        ],
        features: ["Academic Programs Grid", "Term Calendar Showcase", "Admissions Enquiry Pipeline"],
      },
    ],
  },
  {
    packageId: "ngo-membership",
    name: "NGO, Foundation & Membership",
    category: "Non-Profit & Associations",
    tagline: "Impact programs, donor accountability, events & member signups",
    description: "Built for charitable foundations, SACCOs, NGOs, and community associations.",
    defaultPalette: "living-waters",
    assignableModules: ["forms-leads", "media-storage", "notifications"],
    templates: [
      {
        id: "ngo-impact-foundation",
        name: "Community Impact & Donor Portal",
        tagline: "Program stories, field outreach updates, transparency report & partner support",
        defaultPalette: "living-waters",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "about", label: "Mission", href: "/about" },
          { id: "services", label: "Programs", href: "/services" },
          { id: "contact", label: "Partner With Us", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Impact Programs"),
        defaultOfferings: [
          { id: "community-relief", name: "Community Uplift Initiatives", description: "Direct field support delivering measurable outcomes to underserved households." },
          { id: "youth-empowerment", name: "Skills & Scholarship Grants", description: "Equipping emerging leaders with vocational tools and mentorship." },
        ],
        features: ["Impact Stories Showcase", "Programs Directory", "Donor & Volunteer Intake"],
      },
    ],
  },
  {
    packageId: "startup-saas",
    name: "Startup & SaaS Product",
    category: "Technology & Platforms",
    tagline: "Product positioning, capability matrix, FAQs & demo booking funnel",
    description: "Modern SaaS and technology product site designed to capture demo requests and build credibility.",
    defaultPalette: "corporate-slate",
    assignableModules: ["forms-leads", "media-storage", "analytics"],
    templates: [
      {
        id: "saas-product-launch",
        name: "SaaS Product & Demo Funnel",
        tagline: "Clear problem-solution hero, feature pillars, security trust bar & demo booking",
        defaultPalette: "corporate-slate",
        defaultNavigation: [
          { id: "home", label: "Product", href: "/" },
          { id: "services", label: "Capabilities", href: "/services" },
          { id: "faq", label: "FAQ", href: "/faq" },
          { id: "contact", label: "Request Demo", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Platform Capabilities", [
          { id: "faq", path: "/faq", title: "Product FAQ", enabled: true, sections: ["hero", "faq"] },
        ]),
        defaultOfferings: [
          { id: "workflow-automation", name: "Automated Workflows", description: "Streamline repetitive operational tasks with full auditability and team controls." },
          { id: "realtime-analytics", name: "Live Operational Visibility", description: "Real-time metrics and exportable reporting across all workspaces." },
          { id: "api-webhooks", name: "API & System Integrations", description: "Connect existing payment, ERP, and messaging providers cleanly." },
        ],
        features: ["Interactive Capability Matrix", "Demo Booking Form", "Security & SLA FAQ"],
      },
    ],
  },
  {
    packageId: "enterprise-erp",
    name: "Enterprise & Corporate Portal",
    category: "Groups & Institutions",
    tagline: "Multi-division presence, governance disclosures, leadership & procurement contact",
    description: "Structured institutional website built for corporate groups, logistics networks, and holding companies.",
    defaultPalette: "sanctuary-charcoal",
    assignableModules: ["forms-leads", "media-storage", "analytics", "notifications"],
    templates: [
      {
        id: "enterprise-group-holding",
        name: "Multi-Division Group Holding",
        tagline: "Subsidiary divisions, governance statements, executive leadership & tender desk",
        defaultPalette: "sanctuary-charcoal",
        defaultNavigation: [
          { id: "home", label: "Overview", href: "/" },
          { id: "about", label: "Governance", href: "/about" },
          { id: "services", label: "Divisions", href: "/services" },
          { id: "contact", label: "Corporate Desk", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Operating Divisions"),
        defaultOfferings: [
          { id: "enterprise-logistics", name: "Supply Chain & Distribution", description: "Compliant national distribution backed by resilient regional hubs." },
          { id: "corporate-shared-services", name: "Shared Operations & Advisory", description: "Unified finance, compliance, and technical infrastructure across subsidiaries." },
        ],
        features: ["Executive & Governance Views", "Operating Division Matrix", "Procurement Enquiry Desk"],
      },
    ],
  },
  {
    packageId: "church-ministry",
    name: "Church & Ministry Platform",
    category: "Faith & Community",
    tagline: "Sermon archive, events, leadership cards, M-Pesa giving & prayer requests",
    description: "Dedicated multi-page ministry storefront backed by @bazion/church-ministry-template.",
    defaultPalette: "maroon-gold",
    assignableModules: ["church-ministry", "media-storage", "analytics"],
    templates: [
      {
        id: "gmfc-revival-signature",
        name: "GMFC Revival & Apostolic Signature",
        tagline: "Editorial portrait leadership cards, M-Pesa giving card, sermons & outreach hub",
        defaultPalette: "maroon-gold",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "visit", label: "Visit", href: "/visit" },
          { id: "ministries", label: "Ministries", href: "/ministries" },
          { id: "about", label: "About", href: "/about" },
          { id: "sermons", label: "Sermons", href: "/sermons" },
          { id: "events", label: "Events", href: "/events" },
          { id: "contact", label: "Contact", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Ministries & Fellowships", [
          { id: "visit", path: "/visit", title: "Plan a Visit", enabled: true, sections: ["hero", "text", "feature-list", "call-to-action"] },
          { id: "ministries", path: "/ministries", title: "Ministries", enabled: true, sections: ["hero", "card-grid", "call-to-action"] },
          { id: "sermons", path: "/sermons", title: "Sermons", enabled: true, sections: ["hero", "media"] },
          { id: "events", path: "/events", title: "Events", enabled: true, sections: ["hero", "events"] },
          { id: "gallery", path: "/gallery", title: "Gallery", enabled: true, sections: ["hero", "gallery"] },
          { id: "giving", path: "/give", title: "Giving", enabled: true, sections: ["hero", "text", "call-to-action"] },
          { id: "terms", path: "/terms", title: "Terms", enabled: true, sections: ["text"] },
        ]),
        defaultOfferings: [
          { id: "sunday-worship", name: "Sunday Worship Celebration", description: "Corporate praise, Word of God, and fellowship for the whole family." },
          { id: "midweek-prayer", name: "Midweek Prayer & Bible Study", description: "Intercession and Scripture exposition building spiritual maturity." },
        ],
        features: ["Portrait & Classic Leadership View", "M-Pesa Paybill & STK Card", "Sermons & Events Hub"],
      },
      {
        id: "church-ministry",
        name: "Modern Sanctuary & Community",
        tagline: "Warm emerald & bronze layout highlighting small groups and community care",
        defaultPalette: "forest-bronze",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "visit", label: "Visit", href: "/visit" },
          { id: "ministries", label: "Ministries", href: "/ministries" },
          { id: "about", label: "About", href: "/about" },
          { id: "contact", label: "Contact", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Ministries", [
          { id: "visit", path: "/visit", title: "Plan a Visit", enabled: true, sections: ["hero", "text", "feature-list"] },
          { id: "ministries", path: "/ministries", title: "Ministries", enabled: true, sections: ["hero", "card-grid"] },
        ]),
        defaultOfferings: [
          { id: "small-groups", name: "Neighborhood Small Groups", description: "Home fellowships nurturing discipleship, prayer, and mutual care." },
          { id: "community-outreach", name: "Community Care & Relief", description: "Practical compassion serving families in the surrounding neighborhood." },
        ],
        features: ["Guest Visit Flow", "Small Groups Directory", "Prayer Requests Inbox"],
      },
      {
        id: "royal-cathedral",
        name: "Royal Cathedral & Heritage",
        tagline: "Dignified navy & amber aesthetic for regional assemblies and campuses",
        defaultPalette: "royal-navy",
        defaultNavigation: [
          { id: "home", label: "Home", href: "/" },
          { id: "about", label: "About", href: "/about" },
          { id: "sermons", label: "Sermons", href: "/sermons" },
          { id: "events", label: "Events", href: "/events" },
          { id: "contact", label: "Contact", href: "/contact" },
        ],
        defaultPages: buildStandardPages("Ministries", [
          { id: "sermons", path: "/sermons", title: "Sermons", enabled: true, sections: ["hero", "media"] },
          { id: "events", path: "/events", title: "Events", enabled: true, sections: ["hero", "events"] },
        ]),
        defaultOfferings: [
          { id: "teaching-archive", name: "Regional Teaching Archive", description: "Recorded messages, conferences, and study notes accessible worldwide." },
          { id: "missions-network", name: "Multi-Campus Missions", description: "Coordinating assemblies and pastoral mentorship across regions." },
        ],
        features: ["Leadership Council Grid", "Teaching Library", "Stewardship & Giving Portal"],
      },
    ],
  },
];

function normalizeSixDigitHex(hex: string | undefined): string | null {
  if (!hex) return null;
  const cleaned = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return `#${cleaned.toUpperCase()}`;
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return `#${cleaned.split("").map((ch) => `${ch}${ch}`).join("").toUpperCase()}`;
  }
  return null;
}

function hexContrastOnWhite(hex: string): number {
  const rgb = [
    Number.parseInt(hex.slice(1, 3), 16) / 255,
    Number.parseInt(hex.slice(3, 5), 16) / 255,
    Number.parseInt(hex.slice(5, 7), 16) / 255,
  ].map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  return 1.05 / (luminance + 0.05);
}

/** Ensures a hex color meets >= 4.5:1 WCAG contrast against white required by `websiteColorSchema`. */
export function ensureAccessibleHexColor(hex: string | undefined, fallback: string): string {
  const normalizedFallback = normalizeSixDigitHex(fallback) ?? "#1F2937";
  let candidate = normalizeSixDigitHex(hex) ?? normalizedFallback;

  if (hexContrastOnWhite(candidate) >= 4.55) {
    return candidate;
  }

  let r = Number.parseInt(candidate.slice(1, 3), 16);
  let g = Number.parseInt(candidate.slice(3, 5), 16);
  let b = Number.parseInt(candidate.slice(5, 7), 16);

  for (let step = 0; step < 48; step += 1) {
    r = Math.max(0, Math.floor(r * 0.92));
    g = Math.max(0, Math.floor(g * 0.92));
    b = Math.max(0, Math.floor(b * 0.92));
    candidate = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
    if (hexContrastOnWhite(candidate) >= 4.55) {
      return candidate;
    }
  }

  return hexContrastOnWhite(normalizedFallback) >= 4.5 ? normalizedFallback : "#1F2937";
}

function sanitizeWebsiteUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function sanitizeExternalHttpsUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function slugifyId(raw: string, index: number): string {
  const normalized = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (/^[a-z][a-z0-9-]*$/.test(normalized)) {
    return normalized.slice(0, 80);
  }
  return `offering-${index + 1}`;
}

export function getWhiteLabelPackageDescriptor(packageId?: string): WhiteLabelPackageDescriptor {
  return (
    platformWhiteLabelPackageCatalog.find((pkg) => pkg.packageId === packageId) ??
    platformWhiteLabelPackageCatalog[0]!
  );
}

export function getWhiteLabelPalette(paletteId?: string): UniversalThemePalette {
  return (
    universalThemePalettes.find((palette) => palette.id === paletteId) ??
    universalThemePalettes[0]!
  );
}

export interface UniversalWhiteLabelInput {
  packageId?: WhiteLabelPackageId;
  templateId?: string;
  tenantSlug: string;
  brandName: string;
  tagline?: string;
  introduction?: string;
  about?: string;
  logoUrl?: string;
  heroImageUrl?: string;
  paletteId?: WhiteLabelPaletteId;
  themeOverrides?: Partial<{
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  }>;
  contact?: {
    email?: string;
    phones?: string[];
    address?: string;
    poBox?: string;
    whatsappNumber?: string;
    googleMapsUrl?: string;
  };
  payment?: {
    mpesaPaybill?: string;
    accountNo?: string;
    accountName?: string;
    instructions?: string;
    currency?: "KES" | "USD" | "EUR" | "GBP";
  };
  social?: {
    youtube?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
    linkedin?: string;
  };
  offerings?: Array<{ id?: string; name: string; description: string; category?: string }>;
  includeStarterContent?: boolean;
}

export interface UniversalWhiteLabelOutput {
  packageDescriptor: WhiteLabelPackageDescriptor;
  template: PackageTemplateDescriptor;
  palette: UniversalThemePalette;
  website: WebsiteConfiguration;
  assignableModules: string[];
  tenantSettings: {
    locale: string;
    timeZone: string;
    defaultCurrency: "KES" | "USD" | "EUR" | "GBP";
    brandName: string;
    primaryColor: string;
    supportEmail: string;
  };
  smeConfig: {
    schemaVersion: "1.0.0";
    website: WebsiteConfiguration;
    business: {
      name: string;
      tagline: string;
      introduction: string;
      about: string;
      services: Array<{ id: string; name: string; description: string }>;
      contact: {
        email?: string;
        telephone?: string;
        address?: string;
      };
      privacyNotice: string;
      privacyNoticeVersion: "1.0.0";
    };
  };
  packageSettings: {
    schemaVersion: "1.0.0";
    packageId: WhiteLabelPackageId;
    templateId: string;
    paletteId: WhiteLabelPaletteId;
    tenantSlug: string;
    organization: {
      name: string;
      tagline: string;
      introduction: string;
      about: string;
    };
    branding: {
      primaryColor: string;
      secondaryColor: string;
      accentColor: string;
      surfaceColor: string;
      logoUrl: string;
      heroImageUrl?: string;
    };
    contact: {
      email: string;
      phones: string[];
      address: string;
      poBox?: string;
      whatsappNumber?: string;
      googleMapsUrl?: string;
    };
    payment: {
      currency: "KES" | "USD" | "EUR" | "GBP";
      mpesaPaybill: string;
      accountNo: string;
      accountName: string;
      instructions: string;
    };
    social: Record<string, string>;
    offerings: PackageTemplateOffering[];
  };
}

/**
 * Generates a white-labeled configuration bundle across ANY Bazion platform package/solution,
 * guaranteeing accessible color contrast, valid `WebsiteConfiguration`, zero residual brand leaks,
 * and module entitlement mappings.
 */
export function createWhiteLabeledPackageConfig(
  input: UniversalWhiteLabelInput,
): UniversalWhiteLabelOutput {
  const inferredFromTemplate = input.templateId
    ? platformWhiteLabelPackageCatalog.find((pkg) =>
        pkg.templates.some((tpl) => tpl.id === input.templateId),
      )?.packageId
    : undefined;
  const resolvedPackage = getWhiteLabelPackageDescriptor(
    input.packageId ?? inferredFromTemplate ?? "sme-website",
  );
  const template =
    resolvedPackage.templates.find((tpl) => tpl.id === input.templateId) ??
    resolvedPackage.templates[0]!;
  const palette = getWhiteLabelPalette(
    input.paletteId ?? template.defaultPalette ?? resolvedPackage.defaultPalette,
  );

  const primaryColor = ensureAccessibleHexColor(
    input.themeOverrides?.primaryColor ?? palette.primaryColor,
    palette.primaryColor,
  );
  const secondaryColor = ensureAccessibleHexColor(
    input.themeOverrides?.secondaryColor ?? palette.secondaryColor,
    palette.secondaryColor,
  );
  const accentColor = ensureAccessibleHexColor(
    input.themeOverrides?.accentColor ?? palette.accentColor,
    palette.accentColor,
  );

  const tenantSlug =
    input.tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "workspace";
  const brandName = input.brandName.trim() || "New Workspace";
  const tagline = input.tagline?.trim() || resolvedPackage.tagline;
  const introduction =
    input.introduction?.trim() ||
    `${brandName} delivers dependable services tailored around clarity, quality, and responsiveness.`;
  const about =
    input.about?.trim() ||
    `${brandName} is structured on modern operations, transparent client communication, and a commitment to measurable community and customer value.`;

  const logoUrl = sanitizeWebsiteUrl(input.logoUrl);
  const heroImageUrl = sanitizeWebsiteUrl(input.heroImageUrl);

  const website = websiteConfigurationSchema.parse({
    schemaVersion: WEBSITE_CONFIGURATION_VERSION,
    branding: {
      primaryColor,
      secondaryColor,
      accentColor,
      ...(logoUrl ? { logoUrl } : {}),
      ...(heroImageUrl ? { heroImageUrl } : {}),
    },
    navigation: template.defaultNavigation,
    seo: {
      title: `${brandName} | ${tagline}`.slice(0, 160),
      description: introduction.slice(0, 320),
    },
    pages: template.defaultPages,
  });

  const phones = (input.contact?.phones ?? [])
    .map((p) => p.trim())
    .filter((p) => p.length >= 7 && p.length <= 30);
  const email = input.contact?.email?.trim() || "";
  const address = input.contact?.address?.trim() || "";
  const poBox = input.contact?.poBox?.trim();
  const whatsappNumber = input.contact?.whatsappNumber?.trim() || phones[0];
  const googleMapsUrl = sanitizeExternalHttpsUrl(input.contact?.googleMapsUrl);

  const currency = input.payment?.currency ?? "KES";
  const paybill = input.payment?.mpesaPaybill?.trim() || "";
  const accountNo = input.payment?.accountNo?.trim() || "";
  const accountName = input.payment?.accountName?.trim() || brandName;
  const paymentInstructions =
    input.payment?.instructions?.trim() ||
    (paybill
      ? `M-Pesa -> Lipa na M-Pesa -> Paybill ${paybill}${accountNo ? ` · Account No: ${accountNo}` : ""}`
      : "Configure mobile money, card, or bank transfer payment instructions in your tenant admin.");

  const socialEntries = Object.entries(input.social ?? {}).flatMap(([key, value]) => {
    const safeUrl = sanitizeExternalHttpsUrl(value);
    return safeUrl ? [[key, safeUrl] as const] : [];
  });
  const social = Object.fromEntries(socialEntries);

  const rawOfferings =
    input.offerings && input.offerings.length > 0
      ? input.offerings.map((item, idx) => ({
          id: slugifyId(item.id || item.name, idx),
          name: item.name.trim().slice(0, 100) || `Offering ${idx + 1}`,
          description:
            item.description.trim().slice(0, 600) ||
            "Comprehensive solution tailored for your organization.",
          ...(item.category ? { category: item.category } : {}),
        }))
      : input.includeStarterContent === false
        ? [
            {
              id: "primary-offering",
              name: `${brandName} Core Offering`,
              description: "Configure your primary service, product line, or program in your tenant workspace.",
            },
          ]
        : template.defaultOfferings;

  const smeServices = rawOfferings.slice(0, 12).map((item, idx) => ({
    id: slugifyId(item.id, idx),
    name: item.name.length >= 2 ? item.name.slice(0, 100) : `Service ${idx + 1}`,
    description:
      item.description.length >= 10
        ? item.description.slice(0, 600)
        : "Trusted offering structured for our clients and community.",
  }));

  const smeConfig: UniversalWhiteLabelOutput["smeConfig"] = {
    schemaVersion: "1.0.0",
    website,
    business: {
      name: brandName.slice(0, 160),
      tagline: tagline.slice(0, 180),
      introduction: introduction.length >= 10 ? introduction.slice(0, 1200) : `${brandName} delivers trusted solutions.`,
      about: about.length >= 20 ? about.slice(0, 6000) : `${brandName} serves customers with professionalism, quality, and care.`,
      services: smeServices,
      contact: {
        ...(email ? { email } : {}),
        ...(phones[0] ? { telephone: phones[0] } : {}),
        ...(address ? { address } : {}),
      },
      privacyNotice:
        "We collect enquiry contact details solely to respond to your request in accordance with applicable data privacy laws.",
      privacyNoticeVersion: WEBSITE_ENQUIRY_PRIVACY_NOTICE_VERSION,
    },
  };

  return {
    packageDescriptor: resolvedPackage,
    template,
    palette,
    website,
    assignableModules: resolvedPackage.assignableModules,
    tenantSettings: {
      locale: "en-KE",
      timeZone: "Africa/Nairobi",
      defaultCurrency: currency,
      brandName,
      primaryColor,
      supportEmail: email,
    },
    smeConfig,
    packageSettings: {
      schemaVersion: "1.0.0",
      packageId: resolvedPackage.packageId,
      templateId: template.id,
      paletteId: palette.id,
      tenantSlug,
      organization: {
        name: brandName,
        tagline,
        introduction,
        about,
      },
      branding: {
        primaryColor,
        secondaryColor,
        accentColor,
        surfaceColor: palette.surfaceColor,
        logoUrl: logoUrl || "",
        ...(heroImageUrl ? { heroImageUrl } : {}),
      },
      contact: {
        email,
        phones,
        address,
        ...(poBox ? { poBox } : {}),
        ...(whatsappNumber ? { whatsappNumber } : {}),
        ...(googleMapsUrl ? { googleMapsUrl } : {}),
      },
      payment: {
        currency,
        mpesaPaybill: paybill,
        accountNo,
        accountName,
        instructions: paymentInstructions,
      },
      social,
      offerings: rawOfferings,
    },
  };
}

export interface UniversalRepoVariable {
  variable: string;
  category: "identity" | "theme" | "contact" | "payment" | "social";
  detectedLiteral: string;
  replacementPreview: string;
}

export interface UniversalRepoExtractionInput {
  repoUrl: string;
  packageId?: WhiteLabelPackageId | "auto";
  configSource?: string;
  styleSource?: string;
  packageJson?: string;
  targetBrand: {
    tenantSlug: string;
    brandName: string;
    tagline?: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    contact?: UniversalWhiteLabelInput["contact"];
    payment?: UniversalWhiteLabelInput["payment"];
    social?: UniversalWhiteLabelInput["social"];
    includeStarterContent?: boolean;
  };
}

export interface UniversalRepoExtractionResult {
  repoUrl: string;
  inferredPackageId: WhiteLabelPackageId;
  detectedFramework: ByowFramework;
  detectedSourceBrand: {
    brandName: string | null;
    tagline: string | null;
    emails: string[];
    phones: string[];
    paybill: string | null;
    accountNo: string | null;
    socialLinks: Record<string, string>;
    colors: {
      primary?: string;
      secondary?: string;
      accent?: string;
    };
    fonts: {
      heading?: string;
      body?: string;
    };
  };
  whiteLabelVariables: UniversalRepoVariable[];
  generated: UniversalWhiteLabelOutput;
}

function matchCssToken(css: string, names: string[]): string | undefined {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = css.match(new RegExp(`${escaped}\\s*:\\s*([^;\\n]+)`, "i"));
    if (match?.[1]) return match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return undefined;
}

function matchConfigString(source: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = source.match(
      new RegExp(`${escaped}\\s*:\\s*(?:"([^"\\n]+)"|'([^'\\n]+)')`, "i"),
    );
    const value = match?.[1] ?? match?.[2];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function detectFrameworkFromPackageJson(packageJson?: string): ByowFramework {
  if (!packageJson) return "nextjs";
  try {
    const parsed = JSON.parse(packageJson) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    if (deps.next) return "nextjs";
    if (deps.astro) return "astro";
    if (deps["@remix-run/react"]) return "remix";
    if (deps.vite || deps.react) return "react-vite";
  } catch {
    // ignore invalid json
  }
  return "nextjs";
}

function inferPackageIdFromSource(combinedText: string): WhiteLabelPackageId {
  const lower = combinedText.toLowerCase();
  if (/\b(sermon|gospel|pastor|bishop|apostle|ministry|church|tithe|worship)\b/.test(lower)) {
    return "church-ministry";
  }
  if (/\b(cart|checkout|sku|product|ecommerce|shopify|woocommerce|storefront)\b/.test(lower)) {
    return "ecommerce";
  }
  if (/\b(clinic|patient|doctor|medical|hospital|pharmacy|triage|dental)\b/.test(lower)) {
    return "clinic-management";
  }
  if (/\b(school|student|tuition|admissions|campus|curriculum|faculty|academy)\b/.test(lower)) {
    return "school-education";
  }
  if (/\b(ngo|nonprofit|foundation|donor|humanitarian|charity)\b/.test(lower)) {
    return "ngo-membership";
  }
  if (/\b(saas|pricing|apiKey|subscription|webhook|developer|dashboard)\b/.test(lower)) {
    return "startup-saas";
  }
  if (/\b(advisory|attorney|legal|practice|retainer|consulting|appointment)\b/.test(lower)) {
    return "professional-services";
  }
  if (/\b(enterprise|holding|subsidiary|governance|procurement|erp)\b/.test(lower)) {
    return "enterprise-erp";
  }
  return "sme-website";
}

/**
 * Inspects ANY external/GitHub website repo's config, stylesheets, and package manifest,
 * infers the platform package vertical (unless explicitly specified), extracts hardcoded
 * source brand literals into parameterized variables, and emits a clean white-labeled package config.
 */
export function extractWhiteLabelFromRepoSource(
  input: UniversalRepoExtractionInput,
): UniversalRepoExtractionResult {
  const configSource = input.configSource ?? "";
  const styleSource = input.styleSource ?? "";
  const detectedFramework = detectFrameworkFromPackageJson(input.packageJson);
  const inferredPackageId =
    input.packageId && input.packageId !== "auto"
      ? input.packageId
      : inferPackageIdFromSource(`${input.repoUrl}\n${configSource}\n${styleSource}\n${input.packageJson ?? ""}`);

  const rawPrimary = matchCssToken(styleSource, ["--color-primary", "--primary", "--brand-primary"]);
  const rawSecondary = matchCssToken(styleSource, [
    "--color-primary-dark",
    "--color-secondary",
    "--secondary",
  ]);
  const rawAccent = matchCssToken(styleSource, ["--color-accent", "--color-gold", "--accent"]);
  const headingFont = matchCssToken(styleSource, ["--font-heading", "--font-display"]);
  const bodyFont = matchCssToken(styleSource, ["--font-body", "--font-sans"]);

  const detectedBrandName =
    matchConfigString(configSource, [
      "fullName",
      "companyName",
      "businessName",
      "organizationName",
      "storeName",
      "ministryName",
      "siteName",
      "brandName",
      "shortName",
      "name",
      "title",
    ]) ?? null;
  const tagline = matchConfigString(configSource, ["tagline", "subtitle", "description"]) ?? null;
  const paybill =
    matchConfigString(configSource, ["paybill", "mpesaPaybill", "tillNumber", "businessNo"]) ?? null;
  const accountNo = matchConfigString(configSource, ["accountNo", "accountNumber"]) ?? null;

  const emails = Array.from(
    new Set((configSource.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []).map((e) => e.trim())),
  );
  const phones = Array.from(
    new Set((configSource.match(/\+\d{1,3}[\s-]?\d{3}[\s-]?\d{5,8}/g) ?? []).map((p) => p.trim())),
  );

  const socialLinks: Record<string, string> = {};
  for (const key of ["youtube", "facebook", "instagram", "twitter", "whatsapp", "linkedin"] as const) {
    const found = matchConfigString(configSource, [key]);
    if (found && /^https?:\/\//i.test(found)) socialLinks[key] = found;
  }

  const normalizedPrimary = normalizeSixDigitHex(rawPrimary);
  const normalizedSecondary = normalizeSixDigitHex(rawSecondary);
  const normalizedAccent = normalizeSixDigitHex(rawAccent);

  const resolvedPrimary = input.targetBrand.primaryColor ?? normalizedPrimary ?? undefined;
  const resolvedSecondary = input.targetBrand.secondaryColor ?? normalizedSecondary ?? undefined;
  const resolvedAccent = input.targetBrand.accentColor ?? normalizedAccent ?? undefined;

  const generated = createWhiteLabeledPackageConfig({
    packageId: inferredPackageId,
    tenantSlug: input.targetBrand.tenantSlug,
    brandName: input.targetBrand.brandName,
    ...(input.targetBrand.tagline ? { tagline: input.targetBrand.tagline } : {}),
    themeOverrides: {
      ...(resolvedPrimary ? { primaryColor: resolvedPrimary } : {}),
      ...(resolvedSecondary ? { secondaryColor: resolvedSecondary } : {}),
      ...(resolvedAccent ? { accentColor: resolvedAccent } : {}),
    },
    ...(input.targetBrand.contact ? { contact: input.targetBrand.contact } : {}),
    ...(input.targetBrand.payment ? { payment: input.targetBrand.payment } : {}),
    ...(input.targetBrand.social ? { social: input.targetBrand.social } : {}),
    ...(input.targetBrand.includeStarterContent !== undefined
      ? { includeStarterContent: input.targetBrand.includeStarterContent }
      : {}),
  });

  const whiteLabelVariables: UniversalRepoVariable[] = [];
  if (detectedBrandName) {
    whiteLabelVariables.push({
      variable: "brand.name",
      category: "identity",
      detectedLiteral: detectedBrandName,
      replacementPreview: generated.packageSettings.organization.name,
    });
  }
  if (tagline) {
    whiteLabelVariables.push({
      variable: "brand.tagline",
      category: "identity",
      detectedLiteral: tagline,
      replacementPreview: generated.packageSettings.organization.tagline,
    });
  }
  if (normalizedPrimary) {
    whiteLabelVariables.push({
      variable: "branding.primaryColor",
      category: "theme",
      detectedLiteral: normalizedPrimary,
      replacementPreview: generated.packageSettings.branding.primaryColor,
    });
  }
  if (normalizedAccent) {
    whiteLabelVariables.push({
      variable: "branding.accentColor",
      category: "theme",
      detectedLiteral: normalizedAccent,
      replacementPreview: generated.packageSettings.branding.accentColor,
    });
  }
  if (emails[0]) {
    whiteLabelVariables.push({
      variable: "contact.email",
      category: "contact",
      detectedLiteral: emails[0],
      replacementPreview: generated.packageSettings.contact.email || "(tenant contact email)",
    });
  }
  if (phones[0]) {
    whiteLabelVariables.push({
      variable: "contact.phones",
      category: "contact",
      detectedLiteral: phones[0],
      replacementPreview: generated.packageSettings.contact.phones[0] || "(tenant phone)",
    });
  }
  if (paybill) {
    whiteLabelVariables.push({
      variable: "payment.mpesaPaybill",
      category: "payment",
      detectedLiteral: paybill,
      replacementPreview: generated.packageSettings.payment.mpesaPaybill || "(tenant paybill)",
    });
  }
  for (const [network, url] of Object.entries(socialLinks)) {
    whiteLabelVariables.push({
      variable: `social.${network}`,
      category: "social",
      detectedLiteral: url,
      replacementPreview: generated.packageSettings.social[network] || `(tenant ${network})`,
    });
  }

  return {
    repoUrl: input.repoUrl,
    inferredPackageId,
    detectedFramework,
    detectedSourceBrand: {
      brandName: detectedBrandName,
      tagline,
      emails,
      phones,
      paybill,
      accountNo,
      socialLinks,
      colors: {
        ...(normalizedPrimary ? { primary: normalizedPrimary } : {}),
        ...(normalizedSecondary ? { secondary: normalizedSecondary } : {}),
        ...(normalizedAccent ? { accent: normalizedAccent } : {}),
      },
      fonts: {
        ...(headingFont ? { heading: headingFont } : {}),
        ...(bodyFont ? { body: bodyFont } : {}),
      },
    },
    whiteLabelVariables,
    generated,
  };
}

export interface ByowComposeInput {
  tenantId: string;
  tenantSlug: string;
  packageId?: WhiteLabelPackageId;
  primaryDomain?: string;
  repoUrl: string;
  branch?: string;
  framework?: ByowFramework;
  port?: number;
  envVars?: Record<string, string>;
}

export interface ByowComposeBlueprint {
  deploymentMode: "byow-dedicated-compose";
  packageId: WhiteLabelPackageId;
  framework: ByowFramework;
  composePath: string;
  internalPort: number;
  healthcheckPath: string;
  composeYaml: string;
  envOverrides: Record<string, string>;
}

/**
 * Generates a hardened Dokploy Docker Compose blueprint for ANY tenant bringing their own
 * pre-built website repository ("Bring Your Own Website" / BYOW), regardless of industry package.
 */
export function generateByowDokployCompose(input: ByowComposeInput): ByowComposeBlueprint {
  const slug = input.tenantSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-") || "tenant";
  const packageId: WhiteLabelPackageId = input.packageId ?? "sme-website";
  const framework: ByowFramework = input.framework ?? "nextjs";
  const branch = input.branch?.trim() || "main";
  const defaultPort = framework === "nextjs" || framework === "remix" ? 3000 : 80;
  const internalPort = input.port ?? defaultPort;
  const healthcheckPath = framework === "nextjs" || framework === "remix" ? "/api/health" : "/";

  const envOverrides: Record<string, string> = {
    TENANT_ID: input.tenantId,
    TENANT_SLUG: slug,
    PACKAGE_ID: packageId,
    BYOW_FRAMEWORK: framework,
    GIT_REPO_URL: input.repoUrl.trim(),
    GIT_BRANCH: branch,
    PORT: String(internalPort),
    ...(input.primaryDomain ? { PRIMARY_DOMAIN: input.primaryDomain.trim() } : {}),
    ...(input.envVars ?? {}),
  };

  const imageOrBuild =
    framework === "wordpress"
      ? "    image: wordpress:6-php8.2-apache"
      : framework === "static"
        ? "    image: nginx:1.27-alpine"
        : "    build:\n      context: .\n      dockerfile: Dockerfile";

  const envLines = Object.entries(envOverrides)
    .map(([key, value]) => `      ${key}: ${JSON.stringify(value)}`)
    .join("\n");

  const composeYaml = [
    `# Generated by Bazion Universal BYOW Onboarding Engine (${packageId}) for tenant ${slug}`,
    `services:`,
    `  web:`,
    imageOrBuild,
    `    restart: unless-stopped`,
    `    environment:`,
    envLines,
    `    expose:`,
    `      - "${internalPort}"`,
    `    healthcheck:`,
    `      test: ["CMD-SHELL", "wget -qO- http://127.0.0.1:${internalPort}${healthcheckPath} || exit 1"]`,
    `      interval: 30s`,
    `      timeout: 5s`,
    `      retries: 3`,
    `    labels:`,
    `      - "com.bazion.tenant.id=${input.tenantId}"`,
    `      - "com.bazion.tenant.slug=${slug}"`,
    `      - "com.bazion.package.id=${packageId}"`,
    `      - "com.bazion.deployment.mode=byow-dedicated-compose"`,
  ].join("\n");

  return {
    deploymentMode: "byow-dedicated-compose",
    packageId,
    framework,
    composePath: `tenants/${slug}/docker-compose.yml`,
    internalPort,
    healthcheckPath,
    composeYaml,
    envOverrides,
  };
}

