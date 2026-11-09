import type { MinistryConfig } from "./church.types.js";

export const globalMissionConfig: MinistryConfig = {
  tenantSlug: "global-mission-fc",
  ministryName: "Global Mission for Christ International",
  tagline: "Revive the Nations. Preach the Gospel. Win Souls.",
  branding: {
    logoUrl: "/images/gmfc-logo.png",
    primaryColor: "#193a31",
    secondaryColor: "#315e50",
    accentColor: "#8b5b29",
    heroBgUrl: "/images/hero-bg-optimized.jpg",
  },
  hero: {
    eyebrow: "Global Mission for Christ International",
    title: "Propagating Revival",
    highlightedTitle: "to the Nations",
    subtitle: "Revive the Nations. Preach the Gospel. Win Souls. — Propagating revival from Kenya to the ends of the earth.",
  },
  contact: {
    phones: ["+1 (512) 785 6994", "+254 721 341793", "+254 710 642 232"],
    email: "globalmissionfc@gmail.com",
    address: "P.O. Box 444 – 10100, Kenya",
    poBox: "P.O. Box 444 – 10100, Kenya",
    whatsappNumber: "254721341793",
  },
  social: {
    youtube: "https://www.youtube.com/@GlobalMissionfc",
    facebook: "https://www.facebook.com/profile.php?id=61591907680791",
    instagram: "https://www.instagram.com/globalmissionfc/",
    twitter: "https://twitter.com/globalmissionfc",
    whatsapp: "https://wa.me/254721341793",
  },
  statistics: [
    { label: "Souls reached", value: 34200, suffix: "+" },
    { label: "Annual conferences", value: 5 },
    { label: "Years of ministry", value: 6, suffix: "+" },
    { label: "Nations touched", value: 10, suffix: "+" },
  ],
  giving: {
    mpesaPaybill: "247247",
    accountName: "GLOBAL · YINV",
    instructions: "Go to M-Pesa > Lipa na M-Pesa > Paybill > Business No: 247247 (Equity Bank) > Account No: 262518",
    suggestedAmounts: [500, 1000, 2500, 5000],
  },
  serviceTimes: [],
  locations: [],
  visitorInfo: { arrival: "", children: "", accessibility: "", parking: "" },
  online: { description: "" },
  scripture: { verse: "", reference: "", version: "" },
  ministries: [],
  galleryImages: [],
  faqs: [],
  metadata: {
    title: "Global Mission for Christ International",
    description: "Propagating revival to the nations through prayer, the Word of God, evangelism, and community outreach. From Kenya to the ends of the earth — Christ for every nation.",
  },
  vision: {
    title: "Our Vision",
    statement:
      "Propagate Revival to the nations of the world and draw men to Christ by the power of the gospel of our Lord Jesus Christ.",
  },
  mission: {
    title: "Our Mission",
    statement:
      "Global Mission for Christ International is dedicated to igniting the fire of revival and to the teachings of the word of God — raising men and women who will impact their generation through prayer, passion, and praise.",
  },
  outreach: {
    title: "Community Outreach",
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
      title: "Passion for Souls",
      icon: "❤️",
      description:
        "We are passionately driven to reach the lost and serve our community with the love of Jesus Christ.",
    },
  ],
  statementOfFaith: [
    {
      topic: "The Holy Scriptures",
      belief:
        "We believe the Bible is the inspired, infallible, and authoritative Word of God, serving as the supreme rule of faith and conduct.",
    },
    {
      topic: "The Eternal Godhead",
      belief:
        "We believe in one God, eternally existent in three persons: Father, Son, and Holy Spirit.",
    },
    {
      topic: "The Lord Jesus Christ",
      belief:
        "We believe in the deity of our Lord Jesus Christ, His virgin birth, sinless life, atoning death on the cross, bodily resurrection, and imminent return.",
    },
    {
      topic: "Salvation by Grace",
      belief:
        "We believe that salvation is the free gift of God through faith in Jesus Christ, apart from human works.",
    },
    {
      topic: "The Holy Spirit & Revival",
      belief:
        "We believe in the baptism of the Holy Spirit with spiritual gifts, empowering believers to preach the gospel with signs following and igniting revival.",
    },
  ],
  leadership: [
    {
      id: "leader-1",
      name: "Rev. Anthony Githui",
      role: "Director",
      bio: "Committed to propagating revival and raising a praying generation across the nations.",
      photoUrl: "/images/anthony-githui.jpg",
    },
    {
      id: "leader-2",
      name: "Apostle Shadrach",
      role: "National Chairman",
      bio: "Overseeing ministry crusades and pastoral fellowship networks.",
      photoUrl: "/images/apostle-shadrach.jpg",
    },
    {
      id: "leader-3",
      name: "Dr. Young",
      role: "Organizing Secretary",
      bio: "Coordinating international conferences and mission trips.",
      photoUrl: "/images/dr-young.jpg",
    },
    {
      id: "leader-4",
      name: "Pastor Betty",
      role: "Secretary General",
      bio: "Serving in ministry administration and prayer outreach.",
      photoUrl: "/images/pastor-betty.jpg",
    },
    {
      id: "leader-5",
      name: "Pastor Kamwaga",
      role: "Treasurer",
      bio: "Stewarding financial resources with transparency and integrity.",
      photoUrl: "/images/pastor-kamwaga.jpg",
    },
    {
      id: "leader-6",
      name: "Rev. Nyaga",
      role: "Coordinator of Council of Bishops",
      bio: "Fostering unity and spiritual alignment among bishops and pastors.",
      photoUrl: "/images/rev-bishop.jpg",
    },
  ],
};
