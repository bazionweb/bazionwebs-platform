export interface SermonItem {
  id: string;
  slug: string;
  title: string;
  speaker: string;
  date: string;
  scriptureReference: string;
  category: string;
  youtubeVideoId: string;
  description: string;
  notes?: string[];
}

export interface EventItem {
  id: string;
  slug: string;
  title: string;
  dateStr: string;
  dayBadge: string;
  monthBadge: string;
  time: string;
  venue: string;
  location: string;
  description: string;
  posterUrl: string;
  registrationOpen: boolean;
  registrationCapacity?: number;
  speakers?: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  eventDate: string;
  caption: string;
}

export interface CampaignItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  targetAmount: number;
  raisedAmount: number;
  currency: string;
}

// Keep optional fixtures empty: ministries should publish their own factual content.
export const sampleSermons: SermonItem[] = [];
export const sampleEvents: EventItem[] = [];
export const sampleGallery: GalleryItem[] = [];
export const sampleCampaigns: CampaignItem[] = [];
