export interface MinistryConfig {
  tenantSlug: string;
  ministryName: string;
  tagline: string;
  branding: {
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    heroBgUrl?: string;
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
    icon: string;
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
