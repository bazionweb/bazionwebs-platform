import type {
  ChurchTheme,
  ChurchDepartment,
  ChurchSmallGroup,
  ChurchAsset,
  ChurchVolunteerTeam,
  ChurchTestimony,
} from "./church.types.js";

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

export interface ThemePresetDefinition {
  id: ChurchTheme["preset"];
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  goldColor?: string;
  creamColor?: string;
  headerStyle: ChurchTheme["headerStyle"];
  heroStyle: ChurchTheme["heroStyle"];
  cardStyle: ChurchTheme["cardStyle"];
  fontPairing: ChurchTheme["fontPairing"];
}

export const churchThemePresets: ThemePresetDefinition[] = [
  {
    id: "maroon-gold",
    name: "Global Mission Maroon & Gold",
    description: "Deep regal maroon, warm amber/gold, and cream backgrounds. Classic evangelical revival heritage.",
    primaryColor: "#4A1110",
    secondaryColor: "#6B1A18",
    accentColor: "#B45E14",
    goldColor: "#D9A857",
    creamColor: "#F8F1E5",
    headerStyle: "classic",
    heroStyle: "rotator",
    cardStyle: "rounded",
    fontPairing: "outfit-inter",
  },
  {
    id: "forest-bronze",
    name: "Cathedral Forest & Bronze",
    description: "Deep pine green, reverent sage, and warm liturgical bronze accents. Grounded and traditional.",
    primaryColor: "#193A31",
    secondaryColor: "#315E50",
    accentColor: "#8B5B29",
    goldColor: "#C99A43",
    creamColor: "#FBF9F5",
    headerStyle: "classic",
    heroStyle: "centered-bold",
    cardStyle: "rounded",
    fontPairing: "jakarta-inter",
  },
  {
    id: "royal-navy",
    name: "Royal Grace Navy & Amber",
    description: "Majestic deep navy blue, slate blue tones, and luminous amber gold. Dignified and modern.",
    primaryColor: "#0F2B48",
    secondaryColor: "#1E4976",
    accentColor: "#A16207",
    goldColor: "#EAB308",
    creamColor: "#F8FAFC",
    headerStyle: "centered",
    heroStyle: "centered-bold",
    cardStyle: "rounded",
    fontPairing: "jakarta-inter",
  },
  {
    id: "living-waters",
    name: "Living Waters Teal & Ochre",
    description: "Vibrant ocean teal, deep marine tones, and warm terracotta ochre. Refreshing, community-oriented.",
    primaryColor: "#0F4C5C",
    secondaryColor: "#136F63",
    accentColor: "#C25E00",
    goldColor: "#FB8500",
    creamColor: "#F4F8F8",
    headerStyle: "centered",
    heroStyle: "rotator",
    cardStyle: "rounded",
    fontPairing: "outfit-inter",
  },
  {
    id: "sanctuary-charcoal",
    name: "Sanctuary Charcoal & Burgundy",
    description: "Sleek charcoal, architectural zinc, and rich wine burgundy. Contemporary and minimalist.",
    primaryColor: "#18181B",
    secondaryColor: "#3F3F46",
    accentColor: "#881337",
    goldColor: "#D97706",
    creamColor: "#FAFAFA",
    headerStyle: "minimal",
    heroStyle: "split-card",
    cardStyle: "sharp",
    fontPairing: "serif-classic",
  },
];

export const sampleDepartments: ChurchDepartment[] = [
  {
    id: "dept-prayer",
    name: "Intercessory & Prayer Ministry",
    description: "Dedicated to praying for church members, ministry outreach, the sick, and spiritual revival across communities.",
    leaderName: "Pastor Grace",
    leaderRole: "Prayer Coordinator",
    meetingSchedule: "Wednesdays 5:00 PM & Friday Vigils",
    icon: "🙏",
  },
  {
    id: "dept-worship",
    name: "Praise & Worship (Choir & Music)",
    description: "Leading heartfelt corporate worship through hymns, contemporary praise, and instrumental excellence.",
    leaderName: "David Ochieng",
    leaderRole: "Music Director",
    meetingSchedule: "Saturdays 3:00 PM Rehearsals",
    icon: "🎵",
  },
  {
    id: "dept-evangelism",
    name: "Evangelism & Community Outreach",
    description: "Organizing street evangelism, door-to-door visitation, crusades, and hospital ministry.",
    leaderName: "Evangelist Mark",
    leaderRole: "Missions Leader",
    meetingSchedule: "First & Third Saturday mornings",
    icon: "🌍",
  },
  {
    id: "dept-hospitality",
    name: "Hospitality, Ushers & Protocol",
    description: "Welcoming worshipers, stewarding order, assisting guests, and serving communion.",
    leaderName: "Deaconess Mary",
    leaderRole: "Chief Usher",
    meetingSchedule: "Sundays 8:30 AM",
    icon: "🤝",
  },
  {
    id: "dept-media",
    name: "Media, Tech & Communications",
    description: "Operating live streaming, stage projection, sound systems, photography, and social media channels.",
    leaderName: "Stephen Mutua",
    leaderRole: "Technical Lead",
    meetingSchedule: "Sundays & Production Days",
    icon: "📹",
  },
  {
    id: "dept-children",
    name: "Sunday School & Children's Church",
    description: "Nurturing children from toddlers to pre-teens in scripture, prayer, memory verses, and biblical character.",
    leaderName: "Teacher Ruth",
    leaderRole: "Sunday School Superintendent",
    meetingSchedule: "Sundays 9:30 AM",
    icon: "👶",
  },
  {
    id: "dept-men",
    name: "Men of Valor Fellowship",
    description: "Equipping men to lead in family, church, and society through brotherhood, prayer, and mentorship.",
    leaderName: "Elder Joseph",
    leaderRole: "Men's Ministry Leader",
    meetingSchedule: "Monthly Fellowship Breakfasts",
    icon: "🛡️",
  },
  {
    id: "dept-women",
    name: "Virtuous Women Fellowship",
    description: "Encouraging women to grow in godliness, family life, community benevolence, and spiritual maturity.",
    leaderName: "Pastor Sarah",
    leaderRole: "Women's Ministry Patron",
    meetingSchedule: "Monthly Prayer & Fellowship",
    icon: "👑",
  },
];

export const sampleMinistries = [
  {
    title: "Sunday Celebration & Worship Gathering",
    description: "Our weekly corporate gathering celebrating Jesus with inspiring praise, anointed preaching, and communion.",
    audience: "Entire congregation and visitors",
  },
  {
    title: "Midweek Bible Study & Discipleship",
    description: "In-depth chapter-by-chapter scriptural exposition, discussions, and spiritual growth practicals.",
    audience: "Adults, youth, and new believers",
  },
  {
    title: "Youth & Young Adults Fellowship",
    description: "Energetic and relevant ministry addressing modern challenges with biblical truth and community.",
    audience: "Teens & young adults (Ages 13–30)",
  },
  {
    title: "Benevolence & Food Distribution",
    description: "Sharing the compassion of Christ with families facing hardship through food relief and essential supplies.",
    audience: "Vulnerable households in the community",
  },
];

export const sampleSmallGroups: ChurchSmallGroup[] = [
  {
    id: "cell-central",
    name: "Central Town Home Fellowship",
    category: "Home Fellowship",
    leaderName: "Elder John",
    meetingSchedule: "Tuesdays 6:00 PM – 7:30 PM",
    locationOrVirtual: "Kenyatta Avenue, Block 4",
    description: "Weekly neighborhood Bible discussion, mutual care, and fellowship.",
  },
  {
    id: "cell-east",
    name: "Eastlands Family Fellowship",
    category: "Family Group",
    leaderName: "Bro. Peter & Sis. Ann",
    meetingSchedule: "Thursdays 6:30 PM – 8:00 PM",
    locationOrVirtual: "Sunrise Estate, House #12",
    description: "Equipping marriages, parenting support, and shared prayer.",
  },
  {
    id: "cell-campus",
    name: "Campus & Young Professionals Cell",
    category: "Young Adults",
    leaderName: "Sister Faith",
    meetingSchedule: "Wednesdays 7:00 PM – 8:30 PM",
    locationOrVirtual: "Campus Student Center & Zoom",
    description: "Biblical ethics in career, campus life, and peer discipleship.",
  },
];

export const sampleAssets: ChurchAsset[] = [
  {
    id: "asset-main-sanctuary",
    name: "Main Sanctuary (750 Seating Capacity)",
    category: "Facilities",
    location: "Main Campus Ground Floor",
    condition: "excellent",
    status: "available",
    notes: "Acoustically treated worship hall with stage, projection screens, and air circulation.",
  },
  {
    id: "asset-fellowship-hall",
    name: "Multi-Purpose Fellowship Hall",
    category: "Facilities",
    location: "Annex Building",
    condition: "good",
    status: "available",
    notes: "Accommodates 200 guests for banquets, youth meetings, and seminar workshops.",
  },
  {
    id: "asset-sound-console",
    name: "32-Channel Digital Stage Audio Console",
    category: "Audio/Visual",
    location: "Sanctuary AV Booth",
    condition: "excellent",
    status: "available",
    notes: "Digital snake, multi-track recording, and individual IEM monitoring capabilities.",
  },
  {
    id: "asset-church-bus",
    name: "Church Transport Bus (33-Seater)",
    category: "Vehicles",
    location: "Church Parking Compound",
    condition: "good",
    status: "available",
    notes: "Provides Sunday shuttle service for elderly members and youth retreat transport.",
  },
  {
    id: "asset-tents-chairs",
    name: "Event Canopy Tents & 500 Folding Chairs",
    category: "Hospitality & Outreaches",
    location: "Outreach Storage Unit",
    condition: "good",
    status: "available",
    notes: "Used for outdoor open-air crusades and community welfare camps.",
  },
];

export const sampleVolunteerTeams: ChurchVolunteerTeam[] = [
  {
    id: "vol-worship",
    title: "Vocalist or Instrumentalist",
    department: "Praise & Worship (Choir & Music)",
    description: "Singing soprano/alto/tenor or playing keys, guitar, bass, or drums in service.",
    requirements: "Basic musical ability and attendance at Saturday rehearsals.",
    coordinatorName: "David Ochieng",
  },
  {
    id: "vol-media",
    title: "Audio Mixer & Camera Operator",
    department: "Media, Tech & Communications",
    description: "Operating live broadcast cameras or mixing live/stream sound.",
    requirements: "Willingness to learn, reliability, and punctuality.",
    coordinatorName: "Stephen Mutua",
  },
  {
    id: "vol-usher",
    title: "Usher & Greeter",
    department: "Hospitality, Ushers & Protocol",
    description: "Welcoming visitors, handing out bulletins, guiding seating, and offering assistance.",
    requirements: "Friendly demeanor, punctuality, and a heart to serve people.",
    coordinatorName: "Deaconess Mary",
  },
  {
    id: "vol-teacher",
    title: "Sunday School Teacher / Helper",
    department: "Sunday School & Children's Church",
    description: "Teaching or assisting with age-graded Bible story classes and children's crafts.",
    requirements: "Love for children and background endorsement from pastoral team.",
    coordinatorName: "Teacher Ruth",
  },
];

export const sampleTestimonies: ChurchTestimony[] = [
  {
    id: "testimony-1",
    authorName: "John K.",
    title: "God's Faithfulness in Job Search",
    story: "After months of unemployment, the church prayed with me. Within two weeks, I received an interview and was hired as an accountant. God is faithful!",
    date: "October 2026",
    verified: true,
  },
  {
    id: "testimony-2",
    authorName: "Mary N.",
    title: "Complete Healing from Migraines",
    story: "I had suffered chronic migraines for over three years. During a Sunday prayer line, the pastor prayed and the pain vanished. I have been completely free since.",
    date: "August 2026",
    verified: true,
  },
];

export const sampleSermons: SermonItem[] = [
  {
    id: "sermon-sample-1",
    slug: "walking-in-faith-and-victory",
    title: "Walking in Faith and Victory",
    speaker: "Senior Pastor",
    date: "2026-11-08",
    scriptureReference: "Hebrews 11:1-6",
    category: "Faith & Spiritual Growth",
    youtubeVideoId: "dQw4w9WgXcQ",
    description: "Discover the foundational biblical principles of walking by faith rather than sight, and experiencing God's victory in daily challenges.",
    notes: [
      "Faith is the substance of things hoped for, the evidence of things not seen.",
      "Without faith, it is impossible to please God.",
      "Walking in faith requires daily obedience to His Word.",
    ],
  },
];

export const sampleEvents: EventItem[] = [
  {
    id: "event-sample-1",
    slug: "annual-revival-conference-2026",
    title: "Annual Revival Conference 2026",
    dateStr: "December 4–7, 2026",
    dayBadge: "04",
    monthBadge: "DEC",
    time: "9:00 AM – 5:00 PM Daily",
    venue: "Main Worship Sanctuary",
    location: "Main Church Campus, Nairobi",
    description: "A 4-day gathering uniting believers across the region for transformative Word, prayer, worship, and spiritual empowerment.",
    posterUrl: "/images/hero-bg-optimized.jpg",
    registrationOpen: true,
    registrationCapacity: 500,
    speakers: ["Senior Pastor", "Guest Evangelist", "Visiting Ministers"],
  },
];

export const sampleGallery: GalleryItem[] = [];

export const sampleCampaigns: CampaignItem[] = [
  {
    id: "camp-sample-1",
    slug: "community-outreach-and-food-drive",
    title: "Community Outreach & Food Drive",
    category: "Benevolence & Missions",
    description: "Providing food packages, blankets, and school packs to 250 vulnerable families in our surrounding community.",
    targetAmount: 300000,
    raisedAmount: 185000,
    currency: "KES",
  },
];
