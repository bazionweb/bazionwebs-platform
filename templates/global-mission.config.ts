import type { MinistryConfig } from "./church.types.js";
import { defaultChurchPages } from "@bazion/church-ministry-contracts";

export const globalMissionConfig: MinistryConfig = {
  tenantSlug: "global-mission-fc",
  ministryName: "Global Mission for Christ International",
  tagline: "Revive the Nations. Preach the Gospel. Win Souls.",
  theme: {
    preset: "maroon-gold",
    headerStyle: "classic",
    heroStyle: "rotator",
    cardStyle: "rounded",
    fontPairing: "outfit-inter",
  },
  branding: {
    logoUrl: "/images/gmfc-logo.png",
    primaryColor: "#4A1110",
    secondaryColor: "#6B1A18",
    accentColor: "#B45E14",
    heroBgUrl: "/images/hero-bg-optimized.jpg",
  },
  hero: {
    eyebrow: "✝ Global Mission for Christ International",
    title: "PROPAGATING REVIVAL",
    highlightedTitle: "TO THE NATIONS",
    subtitle: "Revive the Nations. Preach the Gospel. Win Souls. — Propagating Revival from Kenya to the ends of the earth.",
    rotatorWords: ["TO THE NATIONS", "TO THE COMMUNITIES", "TO THE WORLD"],
  },
  // GMFC is a borderless mission network, not a localized entity: contact is
  // digital-first (email, WhatsApp, socials, hub coordinators) and the PO Box
  // is demoted to registered-office mailing detail rather than public identity.
  contact: {
    phones: ["+1 (512) 785 6994", "+254 721 341793", "+254 710 642 232"],
    email: "globalmissionfc@gmail.com",
    address: "Digital-first mission network — coordinated online across timezones (no campus address). Registered-office mailing: P.O. Box 444 – 10100, Kenya.",
    poBox: "P.O. Box 444 – 10100, Kenya (registered office mailing)",
    whatsappNumber: "254721341793",
  },
  social: {
    youtube: "https://www.youtube.com/@GlobalMissionfc",
    facebook: "https://www.facebook.com/profile.php?id=61591907680791",
    instagram: "https://www.instagram.com/globalmissionfc/",
    twitter: "https://twitter.com/globalmissionfc",
    whatsapp: "https://wa.me/254721341793",
  },
  navigation: [
    { id: "home", label: "Home", href: "/" },
    { id: "about", label: "About", href: "/about" },
    { id: "gallery", label: "Gallery", href: "/gallery" },
    { id: "sermons", label: "Sermons", href: "/sermons" },
    { id: "events", label: "Events", href: "/events" },
    { id: "contact", label: "Contact", href: "/contact" },
  ],
  pages: defaultChurchPages,
  statistics: [
    { label: "Souls Reached", value: 34200, suffix: "+" },
    { label: "Annual Conferences", value: 5, suffix: "" },
    { label: "Years of Ministry", value: 6, suffix: "+" },
    { label: "Nations Touched", value: 10, suffix: "+" },
  ],
  giving: {
    mpesaPaybill: "247 247",
    accountName: "GLOBAL · YINV",
    instructions: "Account No: 262518 — M-Pesa → Lipa na M-Pesa → Paybill → Business No: 247 247 (Equity Bank) → Account No: 262518 (GLOBAL · YINV)",
    suggestedAmounts: [500, 1000, 2500, 5000],
  },
  // Network rhythms (replacing localized Sunday-service times): global,
  // multi-timezone gatherings streamed through the network's broadcast channel.
  serviceTimes: [
    {
      label: "Global Prayer Call",
      day: "Daily",
      time: "05:30 & 21:00 EAT",
      note: "Network-wide intercession line — join from any timezone.",
    },
    {
      label: "Global Worship & Word Service",
      day: "Sunday",
      time: "09:00 EAT",
      note: "Streamed live on the GMFC broadcast channel.",
    },
    {
      label: "Revival Night",
      day: "Wednesday",
      time: "19:00 EAT",
      note: "Online gathering with worship, the Word and prayer ministry.",
    },
    {
      label: "Leaders' Conclave",
      day: "Monthly (last Friday)",
      time: "18:00 EAT",
      note: "Coordination and fellowship for network leaders across nations.",
    },
  ],
  // Network presence (replacing campus locations): regional hubs and the
  // online campus, described by their coordination role. No street addresses,
  // no map links — the network is not a localized entity.
  locations: [
    {
      name: "East & Central Africa Hub",
      address: "Regional coordination hub serving partner ministries across East and Central Africa — connect with the hub coordinator for nation-specific engagements.",
    },
    {
      name: "Global Network Office",
      address: "Network coordination office (Nairobi, Kenya) — administration, partnerships and broadcast coordination for the global network.",
    },
    {
      name: "Online Network Campus",
      address: "The network's always-on digital campus: live streams, prayer lines and online gatherings accessible from every timezone.",
    },
  ],
  // Partner onboarding (replacing campus visitor info): the four steps a
  // ministry or missionary takes to join the network.
  visitorInfo: {
    arrival: "Step 1 — Reach out: contact the network team through email, WhatsApp or the contact form with a short introduction of your ministry.",
    children: "Step 2 — Discovery call: meet the network coordination team online to share your vision, coverage and calling, and hear how the network operates.",
    accessibility: "Step 3 — Alignment & covenant: review the network's statement of faith and values together, and agree the covenant that frames the partnership.",
    parking: "Step 4 — Onboarding: receive your network orientation, coordination contacts and rhythm of gatherings, and be commissioned as a partner ministry.",
  },
  online: {
    liveStreamUrl: "https://www.youtube.com/@GlobalMissionfc",
    description: "Join our online community and watch our latest sermons, worship sessions, and ministry updates directly on our official YouTube channel.",
  },
  scripture: {
    verse: "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.",
    reference: "2 Corinthians 9:7",
    version: "NIV",
  },
  departments: [],
  // Network departments (replacing local church departments): the five
  // operational arms that coordinate the mission network across nations.
  ministries: [
    {
      title: "Missions & Church Planting",
      description: "Sends and supports church-planting teams and missionaries across the network's nations, from Kenya to the ends of the earth.",
      audience: "Network-wide",
    },
    {
      title: "Prayer Mobilization",
      description: "Coordinates the Global Prayer Call, prayer summits and intercession chains that sustain revival across partner ministries.",
      audience: "Intercessors",
    },
    {
      title: "Media & Broadcast",
      description: "Produces and broadcasts network teaching, worship and revival content through the GMFC YouTube channel and partner media outlets.",
      audience: "Media volunteers",
    },
    {
      title: "Training & Leadership Development",
      description: "Raises and equips ministers and church leaders through network schools, mentorship tracks and leadership summits.",
      audience: "Emerging leaders",
    },
    {
      title: "Compassion & Medical Outreach",
      description: "Organizes free medical camps, compassion outreaches and community care initiatives together with partner ministries.",
      audience: "Outreach partners",
    },
  ],
  groups: [],
  volunteerTeams: [],
  testimonies: [],
  galleryImages: [
    {
      imageUrl: "/images/images/IMG-20260515-WA0002.jpg",
      alt: "IMG 20260515 WA0002",
    },
    {
      imageUrl: "/images/images/IMG-20260514-WA0009-720x684.jpg",
      alt: "IMG 20260514 WA0009 720x684",
    },
    {
      imageUrl: "/images/images/IMG-20260514-WA0005-1536x1152.jpg",
      alt: "IMG 20260514 WA0005 1536x1152",
    },
    {
      imageUrl: "/images/images/IMG-20260514-WA0010.jpg",
      alt: "IMG 20260514 WA0010",
    },
    {
      imageUrl: "/images/images/IMG-20260515-WA0001-768x1083.jpg",
      alt: "IMG 20260515 WA0001 768x1083",
    },
    {
      imageUrl: "/images/images/IMG-20260517-WA0013-845x530.jpg",
      alt: "IMG 20260517 WA0013 845x530",
    },
  ],
  // Network-positioning FAQs (answering the localized-church assumption head-on).
  faqs: [
    {
      question: "Is GMFC a local church?",
      answer: "No. Global Mission for Christ International is a mission network — a family of partner ministries, congregations and missionaries across nations. We do not operate as a single local congregation and there is no campus or local membership boundary.",
    },
    {
      question: "Where is GMFC located?",
      answer: "GMFC is coordinated digitally from the Global Network Office in Nairobi, Kenya, with regional hubs and an always-on online campus. The network deliberately has no single street address because it is not a localized entity — registered-office mail goes to P.O. Box 444 – 10100, Kenya.",
    },
    {
      question: "How can my ministry join the network?",
      answer: "Reach out through our contact channels, join a discovery call, move through alignment and covenant, and complete onboarding. Partner ministries keep their identity and local coverage while gaining the network's prayer rhythms, training, media and mission support.",
    },
    {
      question: "How can I partner or give?",
      answer: "You can give toward missions through M-Pesa Paybill 247 247 (Equity Bank, account 262518), or contact the network office to discuss partnerships, mission sponsorship and compassion outreach support.",
    },
  ],
  metadata: {
    title: "Global Mission for Christ International — Mission Network",
    description: "A borderless mission network of partner ministries and missionaries — propagating revival to the nations through prayer, the Word, evangelism and compassion, coordinated digitally from Nairobi. Not a local church: a global network with no campus boundary.",
  },
  vision: {
    title: "Vision",
    statement:
      "Propagate Revival to the nations of the world and draw men to Christ by the power of the gospel of our Lord Jesus Christ.",
  },
  mission: {
    title: "Mission",
    statement:
      "Global Mission for Christ International is dedicated to igniting the fire of revival and to the teachings of the word of God — raising men and women who will impact their generation through prayer, passion, and praise.",
  },
  outreach: {
    title: "Outreach",
    statement:
      "We reach communities through the Gospel, prayer gatherings, revival meetings, and acts of compassion — supporting the needy through medical and community outreach programs.",
  },
  coreValues: [
    {
      title: "Prayers",
      icon: "🙏",
      description:
        "We believe in the power of persistent, fervent prayer to transform lives, communities, and nations.",
    },
    {
      title: "Word of God",
      icon: "📖",
      description:
        "We are committed to the infallible truth of Scripture as the foundation for our faith and daily living.",
    },
    {
      title: "Power of the Holy Spirit",
      icon: "🔥",
      description:
        "We yield to the leading, gifts, and transformative power of the Holy Spirit in all we do.",
    },
    {
      title: "Righteousness",
      icon: "✝️",
      description:
        "We pursue a life of integrity, purity, and holiness that reflects the character of Christ.",
    },
    {
      title: "Passion",
      icon: "❤️",
      description:
        "We are passionately driven to reach the lost and serve our community with the love of Jesus.",
    },
  ],
  statementOfFaith: [],
  leadership: [
    {
      id: "leader-1",
      name: "Anthony Githui",
      role: "Director",
      bio: "At Global Mission for Christ International, our heartbeat is to see lives transformed by the power of Jesus Christ and revival spread to the nations of the world. We are committed to raising men and women grounded in prayer, rooted in the Word of God, empowered by the Holy Spirit, passionate for righteousness, and dedicated to impacting their generation for Christ. As a ministry, we continue to reach communities through the Gospel, prayer gatherings, revival meetings, and acts of compassion — supporting the needy through medical and community outreach programs. May this ministry continue to inspire faith, ignite passion for God, and draw many into a deeper relationship with Christ. Together, let us shine His light and carry the message of hope to the world.",
      photoUrl: "/images/anthony-githui.jpg",
    },
    {
      id: "leader-2",
      name: "Apostle Shadrach",
      role: "National Chairman",
      photoUrl: "/images/apostle-shadrach.jpg",
    },
    {
      id: "leader-3",
      name: "Dr. Young",
      role: "Organizing Secretary",
      photoUrl: "/images/dr-young.jpg",
    },
    {
      id: "leader-4",
      name: "Pastor Betty",
      role: "Secretary General",
      photoUrl: "/images/pastor-betty.jpg",
    },
    {
      id: "leader-5",
      name: "Pastor Kamwaga",
      role: "Treasurer",
      photoUrl: "/images/pastor-kamwaga.jpg",
    },
    {
      id: "leader-6",
      name: "Rev. Nyaga",
      role: "Coordinator of Council of Bishops",
      photoUrl: "/images/rev-bishop.jpg",
    },
  ],
};
