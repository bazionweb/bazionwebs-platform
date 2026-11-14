import type {
  ChurchPublicSiteSettings,
  ChurchTheme,
  ChurchDepartment,
  ChurchSmallGroup,
  ChurchAsset,
  ChurchVolunteerTeam,
  ChurchTestimony,
} from "@bazion/church-ministry-contracts";

export type {
  ChurchTheme,
  ChurchDepartment,
  ChurchSmallGroup,
  ChurchAsset,
  ChurchVolunteerTeam,
  ChurchTestimony,
};

export interface MinistryConfig {
  tenantSlug: string;
  ministryName: string;
  tagline: string;
  theme?: ChurchTheme;
  branding: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    heroBgUrl?: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    highlightedTitle: string;
    subtitle: string;
    rotatorWords?: string[];
  };
  contact: {
    phones: string[];
    email: string;
    address: string;
    poBox?: string;
    whatsappNumber?: string;
  };
  social: {
    youtube?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    whatsapp?: string;
  };
  navigation: ChurchPublicSiteSettings["navigation"];
  pages: ChurchPublicSiteSettings["pages"];
  statistics: Array<{
    label: string;
    value: number | string;
    suffix?: string;
    prefix?: string;
  }>;
  giving: {
    mpesaPaybill: string;
    accountName: string;
    instructions: string;
    suggestedAmounts: number[];
  };
  serviceTimes: Array<{ label: string; day: string; time: string; note?: string }>;
  locations: Array<{ name: string; address: string; mapUrl?: string }>;
  visitorInfo: { arrival: string; children: string; accessibility: string; parking: string };
  online: { liveStreamUrl?: string; description: string };
  scripture: { verse: string; reference: string; version: string };
  departments?: ChurchDepartment[];
  ministries: Array<{ title: string; description: string; audience?: string }>;
  groups?: ChurchSmallGroup[];
  volunteerTeams?: ChurchVolunteerTeam[];
  testimonies?: ChurchTestimony[];
  galleryImages: Array<{ imageUrl: string; alt: string; caption?: string }>;
  faqs: Array<{ question: string; answer: string }>;
  metadata: { title: string; description: string };
  vision: {
    title: string;
    statement: string;
  };
  mission: {
    title: string;
    statement: string;
  };
  outreach: {
    title: string;
    statement: string;
  };
  coreValues: Array<{
    title: string;
    icon?: string;
    description: string;
  }>;
  statementOfFaith: Array<{
    topic: string;
    belief: string;
  }>;
  leadership: Array<{
    id: string;
    name: string;
    role: string;
    bio?: string;
    photoUrl?: string;
  }>;
}
