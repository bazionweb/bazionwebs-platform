import { hashPin } from '../utils/hashPin';
import { generateOrgEmail, createAlias, checkAliasExists, loadImprovMXConfig } from './improvmxService';

const REGISTRATION_THRESHOLD = 500;

export interface MemberContact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  email_tier?: string;
  org_email?: string | null;
}

export interface RegistrationStatus {
  totalPaid: number;
  thresholdMet: boolean;
  hasContact: boolean;
  missingFields: string[];
  canProvision: boolean;
}

export function computeRegistrationStatus(
  memberId: string,
  transactions: { memberId?: string; category: string; amount: number }[],
  member?: MemberContact | null,
): RegistrationStatus {
  const totalPaid = transactions
    .filter((t) => t.memberId === memberId && t.category === 'Registration Fee')
    .reduce((sum, t) => sum + t.amount, 0);

  const missingFields: string[] = [];
  if (!member?.email) missingFields.push('Email');
  if (!member?.phone) missingFields.push('Phone');

  return {
    totalPaid,
    thresholdMet: totalPaid >= REGISTRATION_THRESHOLD,
    hasContact: !!(member?.email || member?.phone),
    missingFields,
    canProvision: totalPaid >= REGISTRATION_THRESHOLD && !!(member?.email || member?.phone),
  };
}

export async function generateMemberPin(memberId: string): Promise<{ pin: string; hashedPin: string }> {
  const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedPin = await hashPin(memberId, generatedPin);
  return { pin: generatedPin, hashedPin };
}

export async function createOrgEmailForMember(
  memberName: string,
  memberId: string,
  emailTier: string,
  forwardTo: string,
  currentOrgEmail?: string | null,
): Promise<{ orgEmail: string | null; auditNote?: string }> {
  if (currentOrgEmail) return { orgEmail: currentOrgEmail };

  const config = loadImprovMXConfig();
  const baseEmail = generateOrgEmail(memberName, config.domain || 'hkmministries.org');
  let orgEmail = baseEmail;

  if (config.apiKey) {
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      const checkResult = await checkAliasExists(orgEmail);
      if (!checkResult.exists) {
        isUnique = true;
      } else {
        const randomDigits = Math.floor(100 + Math.random() * 900);
        const parts = baseEmail.split('@');
        orgEmail = `${parts[0]}.${randomDigits}@${parts[1]}`;
      }
      attempts++;
    }
    if (isUnique) {
      await createAlias(orgEmail, forwardTo);
      return { orgEmail };
    }
  }

  if (emailTier === 'leadership') {
    return { orgEmail: null, auditNote: 'Leadership tier — manual Google Workspace alias required' };
  }

  return { orgEmail: null, auditNote: 'ImprovMX not configured — org email skipped' };
}
