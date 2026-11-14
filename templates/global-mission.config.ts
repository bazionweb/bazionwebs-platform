import type { MinistryConfig } from "./church.types.js";
import { defaultChurchNavigation, defaultChurchPages } from "@bazion/church-ministry-contracts";

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
  navigation: defaultChurchNavigation,
  pages: defaultChurchPages,
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
    suggestedAmounts: [500, 1000, 2500, 5000, 10000],
  },
  serviceTimes: [
    {
      label: "Sunday Worship & Revival Celebration",
      day: "Sunday",
      time: "9:00 AM – 1:00 PM",
      note: "Main Worship Sanctuary, Kiamariga & Broadcast Live on YouTube",
    },
    {
      label: "Midweek Prayer & Word Exposition",
      day: "Wednesday",
      time: "5:00 PM – 7:00 PM",
      note: "Fellowship Hall & Online Streaming via Zoom & YouTube",
    },
    {
      label: "Overnight Revival Kesha",
      day: "Every Last Friday of the Month",
      time: "9:00 PM – 5:00 AM",
      note: "All-night spiritual warfare, intercession, and prophetic worship",
    },
  ],
  locations: [
    {
      name: "Kiamariga Mission Grounds",
      address: "Kiamariga Nursery School Grounds (Near Sagana State Lodge), Nyeri County, Kenya",
      mapUrl: "https://maps.google.com/?q=Sagana+State+Lodge+Kiamariga",
    },
    {
      name: "Nyeri Town Ministry Center",
      address: "Y.M.C.A. Hall – Nyeri Town, Kenya",
      mapUrl: "https://maps.google.com/?q=YMCA+Nyeri",
    },
  ],
  visitorInfo: {
    arrival: "Welcome to Global Mission for Christ International! Our hospitality and ushering team will greet you with a warm smile at the entrance, hand you a visitor pack, and help you find comfortable seating. Services start promptly, so we recommend arriving 15 minutes early.",
    children: "We provide an active and joyful Sunday School & Children's Ministry with age-appropriate Bible study, memory verses, action songs, and prayer while adults worship in the main sanctuary.",
    accessibility: "All our assembly facilities provide step-free ground access, wheelchair accommodation, and reserved seating for elders, expectant/nursing mothers, and persons with disabilities.",
    parking: "Secure, stewarded on-site parking is provided with dedicated protocol attendants directing vehicles upon arrival.",
  },
  online: {
    liveStreamUrl: "https://www.youtube.com/@GlobalMissionfc",
    description: "Experience Global Mission Online! Join our international digital congregation for live sermons, worship sessions, and Spirit-led ministry updates directly on our official YouTube channel.",
  },
  scripture: {
    verse: "Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.",
    reference: "2 Corinthians 9:7",
    version: "NIV",
  },
  departments: [
    {
      id: "dept-intercession",
      name: "Intercessory & Prayer Force",
      description: "A consecrated team of prayer warriors dedicated to standing in the gap for the nations, ministry leaders, revival outbreaks, and individual prayer petitions.",
      leaderName: "Pastor Betty",
      leaderRole: "Head of Intercession & Secretary General",
      meetingSchedule: "Wednesdays 4:00 PM & Friday Vigils",
      icon: "🙏",
    },
    {
      id: "dept-worship",
      name: "Praise & Worship (Choir & Music Ministry)",
      description: "Leading the body of Christ into heartfelt, Spirit-led worship that ushers in the tangible presence and glory of God in all gatherings.",
      leaderName: "Minister David",
      leaderRole: "Worship Director",
      meetingSchedule: "Saturdays 2:00 PM – 5:00 PM Rehearsals",
      icon: "🎵",
    },
    {
      id: "dept-evangelism",
      name: "Evangelism, Missions & Church Planting",
      description: "Coordinating rural and urban revival crusades, door-to-door gospel outreach, school missions, and planting vibrant prayer altars across East Africa.",
      leaderName: "Apostle Shadrach",
      leaderRole: "National Chairman",
      meetingSchedule: "Monthly Outreach & Evangelism Saturdays",
      icon: "🌍",
    },
    {
      id: "dept-medical",
      name: "Free Medical Camp & Compassion Outreach",
      description: "Demonstrating the love of Christ through free medical checkups, doctor consultations, essential medication dispensing, and community food support.",
      leaderName: "Dr. Young",
      leaderRole: "Organizing Secretary & Medical Coordinator",
      meetingSchedule: "Quarterly Outreaches & Annual August Mega Camp",
      icon: "🩺",
    },
    {
      id: "dept-media",
      name: "Media, Sound & Digital Broadcasting",
      description: "Capturing, livestreaming, and propagating the Word to the global online audience via YouTube, social channels, and high-fidelity sound engineering.",
      leaderName: "Brother Stephen",
      leaderRole: "Head of Media & Tech",
      meetingSchedule: "Sundays & Production Days",
      icon: "📹",
    },
    {
      id: "dept-hospitality",
      name: "Ushers, Protocol & Hospitality",
      description: "Creating an atmosphere of warmth, order, and excellence for every member, first-time visitor, and visiting dignitary.",
      leaderName: "Deaconess Mary",
      leaderRole: "Head Usher",
      meetingSchedule: "Sundays 8:00 AM Briefing",
      icon: "🤝",
    },
    {
      id: "dept-men",
      name: "Men of Valor Fellowship",
      description: "Empowering Christian men to become spiritual leaders in their homes, businesses, and communities through brotherhood and biblical mentorship.",
      leaderName: "Pastor Kamwaga",
      leaderRole: "Treasurer & Men's Director",
      meetingSchedule: "Second Saturday of Every Month 7:00 AM Breakfast",
      icon: "🛡️",
    },
    {
      id: "dept-women",
      name: "Virtuous Women Fellowship",
      description: "Raising women of prayer, wisdom, and virtue who impact their families, nurture the next generation, and support community welfare.",
      leaderName: "Rev. Jane",
      leaderRole: "Women's Ministry Patron",
      meetingSchedule: "Third Saturday of Every Month 2:00 PM",
      icon: "👑",
    },
  ],
  ministries: [
    {
      title: "Annual Mega Conferences & Revival Summits",
      description: "Flagship national and international gatherings uniting believers, pastors, and bishops for prophetic teachings, spiritual renewal, and healing.",
      audience: "All believers, ministers, and seekers across nations",
    },
    {
      title: "Free Medical Camps & Humanitarian Outreach",
      description: "Providing free healthcare, consultations, and prescribed medications to underprivileged communities during major mission campaigns.",
      audience: "Local communities, families, elderly, and children in need",
    },
    {
      title: "Mission Impact Breakfasts & Leadership Summits",
      description: "Strategic morning gatherings connecting Christian professionals, partners, and business leaders to resource the harvest.",
      audience: "Ministry partners, business leaders, professionals, and donors",
    },
    {
      title: "Youth & Campus Revival Fire",
      description: "Igniting young men and women in high schools and colleges with a passion for righteousness, holy living, and purposeful leadership.",
      audience: "Youth, students, and young professionals (Ages 13–35)",
    },
    {
      title: "Pastoral Fellowship & Council of Bishops",
      description: "Fostering inter-denominational unity, doctrinal purity, and spiritual mentorship for pastors and bishops serving in grassroots ministries.",
      audience: "Ordained ministers, pastors, evangelists, and bishops",
    },
  ],
  groups: [
    {
      id: "group-kiamariga",
      name: "Kiamariga Central Revival Cell",
      category: "Home Fellowship",
      leaderName: "Elder Samuel Mwangi",
      meetingSchedule: "Tuesdays 6:00 PM – 7:30 PM",
      locationOrVirtual: "Kiamariga Township, near Central Market",
      description: "Weekly neighborhood Bible study, prayer, and community welfare check-ins.",
    },
    {
      id: "group-nyeri",
      name: "Nyeri Town Faith Circle",
      category: "City Center Fellowship",
      leaderName: "Sister Grace Wanjiru",
      meetingSchedule: "Thursdays 5:30 PM – 7:00 PM",
      locationOrVirtual: "YMCA Hall Room 4, Nyeri Town",
      description: "Midweek spiritual encouragement for working professionals and town residents.",
    },
    {
      id: "group-sagana",
      name: "Sagana Valley Prayer Altar",
      category: "Intercessory Cell",
      leaderName: "Bro. Patrick Kariuki",
      meetingSchedule: "Wednesdays 6:00 PM – 7:30 PM",
      locationOrVirtual: "Sagana Junction Fellowship Room",
      description: "Deep intercession, spiritual warfare, and personal discipleship for believers.",
    },
    {
      id: "group-diaspora",
      name: "Global Diaspora Prayer Network",
      category: "Online International Cell",
      leaderName: "Dr. Young & Pastor Betty",
      meetingSchedule: "Saturdays 8:00 PM EAT / 1:00 PM EST",
      locationOrVirtual: "Zoom / Online Gathering",
      description: "Connecting partners and believers across North America, Europe, and the diaspora in unified prayer.",
    },
  ],
  volunteerTeams: [
    {
      id: "vol-medical",
      title: "Medical Camp Health Professionals & Nurses",
      department: "Free Medical Camp & Compassion Outreach",
      description: "Registered medical officers, nurses, pharmacists, and lab techs who volunteer during free medical outreach camps.",
      requirements: "Medical/Nursing credentials or experience in healthcare assistance.",
      coordinatorName: "Dr. Young",
    },
    {
      id: "vol-media",
      title: "Camera, Livestream & Video Editors",
      department: "Media, Sound & Digital Broadcasting",
      description: "Operating broadcast cameras, mixing audio, and publishing sermon reels and social content.",
      requirements: "Basic familiarity with camera handling, audio mixing, or willingness to undergo practical training.",
      coordinatorName: "Brother Stephen",
    },
    {
      id: "vol-prayer",
      title: "Prayer Watchmen & Intercessory Team",
      department: "Intercessory & Prayer Force",
      description: "Covering the ministry, conferences, leadership, and incoming prayer petitions in fervent prayer.",
      requirements: "Heart for persistent prayer, confidentiality, and spiritual dedication.",
      coordinatorName: "Pastor Betty",
    },
    {
      id: "vol-protocol",
      title: "Guest Welcoming, Ushers & Protocol",
      department: "Ushers, Protocol & Hospitality",
      description: "Welcoming visitors, guiding attendees, assisting elderly and mothers, and stewarding orderly gatherings.",
      requirements: "Warm disposition, punctuality, and a heart for Christian service.",
      coordinatorName: "Deaconess Mary",
    },
  ],
  testimonies: [
    {
      id: "testimony-1",
      authorName: "Mama Esther W., Nyeri",
      title: "Divine Healing of Chronic Arthritis",
      story: "For five years I suffered severe knee pain and could barely walk without a walking stick. During the 4th Annual Mega Conference, prayers were made and the power of God touched me. I threw away my stick and have been walking pain-free ever since! All glory to God!",
      date: "August 2024",
      verified: true,
    },
    {
      id: "testimony-2",
      authorName: "James M., Karatina",
      title: "Saved from Addiction and Restored to Family",
      story: "I attended the Mt. Kenya Revival meetings feeling hopeless and broken by alcoholism. When Rev. Anthony made the altar call, I surrendered my life to Jesus Christ. That very evening the chains of addiction broke. Today my marriage is restored and I am serving joyfully in the choir.",
      date: "April 2024",
      verified: true,
    },
    {
      id: "testimony-3",
      authorName: "Beatrice K., Sagana",
      title: "Free Medical Camp Diagnosed and Treated My Child",
      story: "My 4-year-old daughter was suffering from persistent chest infections and we could not afford private specialists. At the GMFC Free Medical Camp, volunteer doctors gave her specialized checkups and provided all the needed medicines at zero cost. She is now healthy and thriving!",
      date: "August 2026",
      verified: true,
    },
  ],
  galleryImages: [
    {
      imageUrl: "/images/gallery/IMG-20260515-WA0002.jpg",
      alt: "Revival conference congregation in fervent prayer and worship",
      caption: "Congregation engaged in prayer and worship during the annual conference.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260514-WA0009.jpg",
      alt: "Mt. Kenya Revival meeting with community members gathering in faith",
      caption: "Revival meetings in Kiamariga near Sagana State Lodge.",
    },
    {
      imageUrl: "/images/events/mega-conference-2026.jpg",
      alt: "5th Annual Mega Conference and Free Medical Camp poster and banner",
      caption: "Theme: Healing the Land — Amos 9:14 'From Exile to Divine Restoration'.",
    },
    {
      imageUrl: "/images/events/mission-impact-breakfast.jpg",
      alt: "Mission Impact Breakfast fellowship at YMCA Hall Nyeri",
      caption: "Partners and ministers gathering for fundraising and prayer.",
    },
    {
      imageUrl: "/images/gallery/MKGAC.jpg",
      alt: "Medical Camp Doctors and Health Volunteers serving community",
      caption: "Free Medical Camp serving hundreds of community members with medicine and care.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260514-WA0005.jpg",
      alt: "Pastoral ordination and council of bishops fellowship",
      caption: "Bishops and pastoral network standing in unity for gospel revival.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260514-WA0010.jpg",
      alt: "Youth choir and worship leaders ministering before the altar",
      caption: "Spirited praise and worship led by the youth choir.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260515-WA0001.jpg",
      alt: "Community outreach and evangelism team distributing food relief",
      caption: "Reaching out with compassionate relief to needy households.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260517-WA0013.jpg",
      alt: "Outdoor crusade tent filled with worshippers",
      caption: "Revival crusade under the grand tent in Nyeri County.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260517-WA0014.jpg",
      alt: "Pastoral prayer over congregation for healing and deliverance",
      caption: "Ministers laying hands and praying for physical and spiritual healing.",
    },
    {
      imageUrl: "/images/gallery/IMG-20260518-WA0002.jpg",
      alt: "Celebration and thanksgiving service following revival conference",
      caption: "Giving praise and thanksgiving for transformed lives.",
    },
    {
      imageUrl: "/images/gallery/IMG-20251111-WA0005.jpg",
      alt: "Mission outreach banner and volunteers at field location",
      caption: "Field evangelism team taking the good news to rural communities.",
    },
  ],
  faqs: [
    {
      question: "What should I expect when visiting for the first time?",
      answer: "Expect a warm, family-friendly welcome from our ushers, powerful Spirit-filled worship, Bible-grounded preaching, and an opportunity for personal prayer. You will be welcomed as an honored guest, not a stranger.",
    },
    {
      question: "How can I access the Free Medical Camp services?",
      answer: "Our Free Medical Camps take place during major conferences and outreaches. Registration is free of charge on site on a first-come, first-served basis. Doctors, clinical officers, and pharmacists provide free consultations, screenings, and medicines.",
    },
    {
      question: "How do I give or partner with the mission via M-Pesa?",
      answer: "Go to M-Pesa > Lipa na M-Pesa > Paybill. Enter Business No. 247247 (Equity Bank) and Account No. 262518 (GLOBAL · YINV). Enter your contribution amount, confirm with your M-Pesa PIN, and you will receive instant confirmation.",
    },
    {
      question: "Can I submit a confidential prayer request?",
      answer: "Yes, absolutely! You can send us your prayer request via the Contact page or by messaging us on WhatsApp (+254 721 341 793). Your petition will be prayed over confidentially by our pastoral and intercessory teams.",
    },
    {
      question: "How can I join a department or volunteer team?",
      answer: "We welcome believers who wish to serve in our departments including Praise & Worship, Medical Camp, Media, Sunday School, and Intercession. Reach out to the secretariat or speak to any department leader after Sunday service.",
    },
  ],
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
      bio: "Committed to propagating revival and raising a praying generation across the nations. Serving as Director of Global Mission for Christ International.",
      photoUrl: "/images/anthony-githui.jpg",
    },
    {
      id: "leader-2",
      name: "Apostle Shadrach",
      role: "National Chairman",
      bio: "Overseeing ministry crusades, pastoral fellowship networks, and national evangelistic outreaches.",
      photoUrl: "/images/apostle-shadrach.jpg",
    },
    {
      id: "leader-3",
      name: "Dr. Young",
      role: "Organizing Secretary",
      bio: "Coordinating international conferences, mission trips, and free community medical camp logistics.",
      photoUrl: "/images/dr-young.jpg",
    },
    {
      id: "leader-4",
      name: "Pastor Betty",
      role: "Secretary General",
      bio: "Serving in ministry administration, intercessory prayer network oversight, and women's fellowship.",
      photoUrl: "/images/pastor-betty.jpg",
    },
    {
      id: "leader-5",
      name: "Pastor Kamwaga",
      role: "Treasurer",
      bio: "Stewarding ministry financial resources with transparency and integrity, and directing the Men of Valor.",
      photoUrl: "/images/pastor-kamwaga.jpg",
    },
    {
      id: "leader-6",
      name: "Rev. Nyaga",
      role: "Coordinator of Council of Bishops",
      bio: "Fostering unity, doctrinal alignment, and fellowship among bishops and senior church pastors across denominations.",
      photoUrl: "/images/rev-bishop.jpg",
    },
  ],
};
