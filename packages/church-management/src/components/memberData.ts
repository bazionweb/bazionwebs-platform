export interface AvatarTransform {
  scale: number; // Zoom level (1 = 100%)
  positionX: number; // Horizontal position (-100 to 100)
  positionY: number; // Vertical position (-100 to 100)
}

export type AgeGroup = 'Children/Sunday School' | 'Junior Youth' | 'Youth' | 'Adult';

export type EmailTier = 'member' | 'leadership';

export interface Member {
  id: string;
  name: string;
  title: string;
  avatar: string;
  avatarTransform?: AvatarTransform;
  phone?: string;
  email?: string;
  department: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Transferred' | 'Pending Fee';
  dateAdded: string;
  dob: string;
  gender: 'Male' | 'Female';
  occupation?: string;
  maritalStatus?: string;
  location?: string;
  ageGroup?: AgeGroup;
  pin?: string | null;
  is_portal_active?: boolean;
  email_tier?: EmailTier;
  org_email?: string;
}

export const calculateAgeGroup = (dob: string): AgeGroup => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  // Adjust age if birthday hasn't occurred this year
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  if (age <= 12) return 'Children/Sunday School';
  if (age <= 18) return 'Junior Youth';
  if (age <= 25) return 'Youth';
  return 'Adult';
};

export const initialMembers: Member[] = [];
