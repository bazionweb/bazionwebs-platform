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

export const sampleSermons: SermonItem[] = [
  {
    id: "sermon-1",
    slug: "propagating-revival-to-the-nations",
    title: "Propagating Revival to the Nations",
    speaker: "Rev. Anthony Githui",
    date: "November 2026",
    scriptureReference: "Habakkuk 3:2; Psalm 85:6",
    category: "Revival",
    youtubeVideoId: "bO9p1a8_zV4",
    description:
      "A clarion call for the body of Christ to return to the altars of fervent prayer, holy living, and evangelism for a nationwide awakening.",
    notes: [
      "Revival begins in personal prayer before it becomes public power.",
      "The Word of God is the burning fuel of spiritual awakening.",
      "Souls are the true prize of every authentic revival movement.",
    ],
  },
  {
    id: "sermon-2",
    slug: "the-power-of-persistent-prayer",
    title: "The Power of Persistent Prayer",
    speaker: "Apostle Shadrach",
    date: "October 2026",
    scriptureReference: "Luke 18:1-8; James 5:16",
    category: "Prayer",
    youtubeVideoId: "dQw4w9WgXcQ",
    description:
      "Discover the keys to praying through until breakthrough arrives. Understanding the altar of intercession.",
    notes: [
      "Men ought always to pray and not faint.",
      "The effective, fervent prayer of a righteous man avails much.",
    ],
  },
  {
    id: "sermon-3",
    slug: "walking-in-the-power-of-the-holy-spirit",
    title: "Walking in the Power of the Holy Spirit",
    speaker: "Rev. Anthony Githui",
    date: "September 2026",
    scriptureReference: "Acts 1:8; Galatians 5:16",
    category: "Holy Spirit",
    youtubeVideoId: "bO9p1a8_zV4",
    description:
      "The Holy Spirit is not a feeling but a divine Person sent to empower the believer for world impact.",
    notes: [
      "Power is given for witness and soul-winning.",
      "Cultivating daily fellowship with the Holy Spirit.",
    ],
  },
  {
    id: "sermon-4",
    slug: "the-call-to-international-missions",
    title: "The Call to International Missions",
    speaker: "Dr. Young",
    date: "August 2026",
    scriptureReference: "Matthew 28:18-20; Mark 16:15",
    category: "Evangelism",
    youtubeVideoId: "bO9p1a8_zV4",
    description:
      "Why every believer must participate in the Great Commission through going, sending, or interceding.",
  },
];

export const sampleEvents: EventItem[] = [
  {
    id: "event-1",
    slug: "annual-revival-conference-2026",
    title: "Annual Global Revival Conference 2026",
    dateStr: "December 12 - 15, 2026",
    dayBadge: "12",
    monthBadge: "DEC",
    time: "8:00 AM - 5:00 PM EAT Daily",
    venue: "Main Ministry Grounds",
    location: "Nyeri / Karatina, Kenya",
    description:
      "Four days of intensive prayer, prophetic teachings, ministry to the sick, and impartation for ministers and leaders from across the nations.",
    posterUrl: "/images/events/conference.jpg",
    registrationOpen: true,
    registrationCapacity: 2000,
    speakers: ["Rev. Anthony Githui", "Apostle Shadrach", "Dr. Young", "Guest Evangelists"],
  },
  {
    id: "event-2",
    slug: "national-medical-outreach-and-crusade",
    title: "National Medical Outreach & Crusade",
    dateStr: "November 28 - 30, 2026",
    dayBadge: "28",
    monthBadge: "NOV",
    time: "9:00 AM - 6:00 PM EAT",
    venue: "Community Outreach Grounds",
    location: "Kirinyaga, Kenya",
    description:
      "Free medical consultations, medication dispensing, prayer for the sick, and evening open-air revival meetings.",
    posterUrl: "/images/events/outreach.jpg",
    registrationOpen: true,
    registrationCapacity: 1500,
    speakers: ["Medical Volunteer Team", "Rev. Anthony Githui"],
  },
  {
    id: "event-3",
    slug: "all-night-prayer-and-worship-vigil",
    title: "All-Night Prayer & Prophetic Worship Vigil",
    dateStr: "November 21, 2026",
    dayBadge: "21",
    monthBadge: "NOV",
    time: "9:00 PM - 5:00 AM EAT",
    venue: "Sanctuary of Praise",
    location: "Kenya",
    description:
      "A night of spiritual warfare, intercession for the nations, and intense worship. Bringing our petitions before the Lord.",
    posterUrl: "/images/events/prayer.jpg",
    registrationOpen: true,
    registrationCapacity: 800,
  },
];

export const sampleGallery: GalleryItem[] = [
  {
    id: "gal-1",
    title: "Revival Crusade Altar Call",
    category: "Crusades",
    imageUrl: "/images/gallery/crusade-1.jpg",
    eventDate: "October 2026",
    caption: "Hundreds responding to the call of salvation during the open-air crusade.",
  },
  {
    id: "gal-2",
    title: "Free Medical Camp Consultation",
    category: "Medical Outreach",
    imageUrl: "/images/gallery/medical-1.jpg",
    eventDate: "September 2026",
    caption: "Volunteer doctors attending to community members in need of healthcare.",
  },
  {
    id: "gal-3",
    title: "Pastoral Leadership Council",
    category: "Conferences",
    imageUrl: "/images/gallery/leadership-1.jpg",
    eventDate: "August 2026",
    caption: "Ministers gathered for leadership training and spiritual impartation.",
  },
  {
    id: "gal-4",
    title: "Community Food Distribution",
    category: "Community Outreach",
    imageUrl: "/images/gallery/community-1.jpg",
    eventDate: "July 2026",
    caption: "Distributing food packs and essentials to vulnerable families.",
  },
  {
    id: "gal-5",
    title: "Night of Intercessory Prayer",
    category: "Prayer Meetings",
    imageUrl: "/images/gallery/prayer-1.jpg",
    eventDate: "June 2026",
    caption: "Believers standing in the gap for national revival and peace.",
  },
  {
    id: "gal-6",
    title: "Youth Worship Explosion",
    category: "Conferences",
    imageUrl: "/images/gallery/youth-1.jpg",
    eventDate: "May 2026",
    caption: "Young people worshiping God with passion and abandonment.",
  },
];

export const sampleCampaigns: CampaignItem[] = [
  {
    id: "camp-1",
    slug: "global-revival-conferences-fund",
    title: "Global Revival Conferences Fund",
    category: "Conferences",
    description:
      "Support the logistics, sound infrastructure, venue hire, and transport for open-air crusades across East Africa.",
    targetAmount: 500000,
    raisedAmount: 320000,
    currency: "KES",
  },
  {
    id: "camp-2",
    slug: "free-medical-outreach-and-drugs-fund",
    title: "Free Medical Outreach & Medication Fund",
    category: "Medical Outreach",
    description:
      "Procure essential pharmaceuticals, medical equipment, and provide free treatment for underprivileged rural communities.",
    targetAmount: 300000,
    raisedAmount: 185000,
    currency: "KES",
  },
  {
    id: "camp-3",
    slug: "bibles-for-new-converts-fund",
    title: "Bibles for New Believers",
    category: "Evangelism",
    description:
      "Provide Swahili and English Bibles to new converts baptized during revival meetings to establish them in the Word.",
    targetAmount: 200000,
    raisedAmount: 145000,
    currency: "KES",
  },
];
