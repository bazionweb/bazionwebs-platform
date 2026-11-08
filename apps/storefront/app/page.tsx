"use client";

import { useState } from "react";
import {
  ChurchNav,
  ChurchFooter,
  PageHero,
  StatsCounter,
  ScriptureQuote,
  SermonCard,
  EventCard,
  TestimonyCard,
  Modal,
} from "@bazion/ui";
import { globalMissionConfig } from "../../../templates/global-mission.config";
import {
  sampleSermons,
  sampleEvents,
  sampleGallery,
} from "../../../templates/church-sample-data";

export default function ChurchHomePage() {
  const [activeVideo, setActiveVideo] = useState<{ title: string; youtubeVideoId?: string } | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; title: string } | null>(null);

  const featuredSermon = sampleSermons[0];
  const upcomingEvents = sampleEvents.slice(0, 3);
  const recentPhotos = sampleGallery.slice(0, 3);

  return (
    <>
      {/* 1. Header Navigation */}
      <ChurchNav
        ministryName={globalMissionConfig.ministryName}
        logoUrl={globalMissionConfig.branding.logoUrl}
        currentPath="/"
        giveHref="/give"
        giveLabel="Give to the Mission"
      />

      <main id="main-content">
        {/* 2. Hero Section */}
        <PageHero
          eyebrow="GLOBAL MISSION FOR CHRIST INTERNATIONAL"
          title="PROPAGATING"
          highlightedTitle="REVIVAL"
          subtitle="Revive the Nations. Preach the Gospel. Win Souls. Raising men and women who impact their generation through prayer, passion, and praise."
          primaryCtaText="Support the Mission"
          primaryCtaHref="/give"
          secondaryCtaText="Watch Latest Sermon"
          secondaryCtaHref="#featured-sermon"
          bgImageUrl={globalMissionConfig.branding.heroBgUrl}
        />

        {/* 3. Ministry Introduction */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Who We Are</span>
              <h2 className="ch-title">Dedicated to Propagating Revival Worldwide</h2>
              <p className="ch-subtitle">
                Global Mission for Christ International is an apostolic and evangelistic ministry
                commissioned to ignite the fires of Holy Ghost revival, win souls for the Kingdom of
                God, and mobilize believers into active mission outreach.
              </p>
            </div>

            <div className="ch-grid-3">
              <div className="ch-card">
                <div className="ch-card-body">
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>🌍</div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--church-primary)" }}>
                    {globalMissionConfig.vision.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {globalMissionConfig.vision.statement}
                  </p>
                </div>
              </div>

              <div className="ch-card">
                <div className="ch-card-body">
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>⛪</div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--church-primary)" }}>
                    {globalMissionConfig.mission.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {globalMissionConfig.mission.statement}
                  </p>
                </div>
              </div>

              <div className="ch-card">
                <div className="ch-card-body">
                  <div style={{ fontSize: "36px", marginBottom: "12px" }}>🌱</div>
                  <h3 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px 0", color: "var(--church-primary)" }}>
                    {globalMissionConfig.outreach.title}
                  </h3>
                  <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                    {globalMissionConfig.outreach.statement}
                  </p>
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "36px" }}>
              <a href="/about" className="ch-btn ch-btn-primary">
                Read More About Our Ministry →
              </a>
            </div>
          </div>
        </section>

        {/* 4. Ministry Statistics Counter */}
        <StatsCounter
          title="Verified Ministry Impact"
          subtitle="Fruitful labor across cities, villages, and nations for the glory of Christ."
          stats={globalMissionConfig.statistics}
        />

        {/* 5. Mission Activities */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Our Pillars</span>
              <h2 className="ch-title">Our Core Ministry Activities</h2>
              <p className="ch-subtitle">
                How we fulfill the Great Commission through targeted evangelistic, spiritual, and
                social initiatives.
              </p>
            </div>

            <div className="ch-grid-3">
              {[
                {
                  title: "Open-Air Evangelism & Crusades",
                  icon: "📢",
                  desc: "Proclaiming the gospel in open-air fields, drawing thousands to salvation, healing, and deliverance.",
                },
                {
                  title: "Holy Ghost Revival Conferences",
                  icon: "🔥",
                  desc: "Empowering pastors, leaders, and youth through deep teachings on holiness, prayer, and spiritual authority.",
                },
                {
                  title: "Free Medical Outreach",
                  icon: "🩺",
                  desc: "Demonstrating the compassion of Jesus by dispensing free medical aid, doctor consultations, and medications.",
                },
                {
                  title: "Intercessory Prayer Vigils",
                  icon: "🙏",
                  desc: "Standing in the gap for nations, governmental leaders, families, and global revival through persistent prayer.",
                },
                {
                  title: "Community Outreach & Relief",
                  icon: "🍞",
                  desc: "Providing food relief, warm clothing, and schooling essentials to needy widows and vulnerable families.",
                },
                {
                  title: "Church Planting & Discipleship",
                  icon: "🏛️",
                  desc: "Establishing vibrant local assemblies to nurture new converts into mature disciples of Jesus Christ.",
                },
              ].map((act) => (
                <div key={act.title} className="ch-card">
                  <div className="ch-card-body">
                    <span style={{ fontSize: "32px", marginBottom: "12px" }}>{act.icon}</span>
                    <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 8px 0", color: "var(--church-primary)" }}>
                      {act.title}
                    </h3>
                    <p style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--church-text-muted)", margin: 0 }}>
                      {act.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Scripture Quotation */}
        <div className="ch-container">
          <ScriptureQuote
            verse="O Lord, I have heard Your speech and was afraid; O Lord, revive Your work in the midst of the years! In the midst of the years make it known; in wrath remember mercy."
            reference="Habakkuk 3:2"
            version="NKJV"
          />
        </div>

        {/* 6. Featured Sermon */}
        <section id="featured-sermon" className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Online Ministry</span>
              <h2 className="ch-title">Latest Message & Teaching</h2>
              <p className="ch-subtitle">
                Be spiritually fed, encouraged, and renewed by the anointed preaching of God&apos;s
                Word.
              </p>
            </div>

            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
              <SermonCard
                id={featuredSermon.id}
                title={featuredSermon.title}
                speaker={featuredSermon.speaker}
                date={featuredSermon.date}
                scriptureReference={featuredSermon.scriptureReference}
                category={featuredSermon.category}
                youtubeVideoId={featuredSermon.youtubeVideoId}
                slug={featuredSermon.slug}
                onWatch={(sermon: { id: string; title: string; youtubeVideoId?: string }) => setActiveVideo(sermon)}
              />
              <div style={{ textAlign: "center", marginTop: "24px" }}>
                <a href="/sermons" className="ch-btn ch-btn-outline">
                  Browse Full Sermon Library →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Upcoming Events */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Calendar</span>
              <h2 className="ch-title">Upcoming Programmes & Conferences</h2>
              <p className="ch-subtitle">
                Join us in person or online for our scheduled revival gatherings and medical camps.
              </p>
            </div>

            <div className="ch-grid-3">
              {upcomingEvents.map((evt) => (
                <EventCard
                  key={evt.id}
                  id={evt.id}
                  title={evt.title}
                  dateStr={evt.dateStr}
                  dayBadge={evt.dayBadge}
                  monthBadge={evt.monthBadge}
                  time={evt.time}
                  venue={evt.venue}
                  location={evt.location}
                  slug={evt.slug}
                  posterUrl={evt.posterUrl}
                  registrationOpen={evt.registrationOpen}
                  onRegister={(e: { id: string; title: string }) => setSelectedEvent(e)}
                />
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: "36px" }}>
              <a href="/events" className="ch-btn ch-btn-primary">
                View All Events & Programmes →
              </a>
            </div>
          </div>
        </section>

        {/* 8. Ministry Gallery Preview */}
        <section className="ch-section ch-section-alt">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Visual Journey</span>
              <h2 className="ch-title">Our Ministry in Action</h2>
              <p className="ch-subtitle">
                Moments of faith, miracles, and transformative love captured during our outreaches.
              </p>
            </div>

            <div className="ch-grid-3">
              {recentPhotos.map((photo) => (
                <div key={photo.id} className="ch-card">
                  <div className="ch-card-media" style={{ height: "220px" }}>
                    <img src={photo.imageUrl} alt={photo.title} loading="lazy" />
                  </div>
                  <div className="ch-card-body">
                    <span className="ch-eyebrow" style={{ fontSize: "11px", marginBottom: "6px" }}>
                      {photo.category} • {photo.eventDate}
                    </span>
                    <h3 style={{ fontSize: "17px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--church-primary)" }}>
                      {photo.title}
                    </h3>
                    <p style={{ fontSize: "13px", color: "var(--church-text-muted)", margin: 0 }}>
                      {photo.caption}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ textAlign: "center", marginTop: "36px" }}>
              <a href="/gallery" className="ch-btn ch-btn-outline">
                Explore Full Missions Gallery →
              </a>
            </div>
          </div>
        </section>

        {/* 9. Testimonies Section */}
        <section className="ch-section">
          <div className="ch-container">
            <div className="ch-heading-wrap">
              <span className="ch-eyebrow">Testimonies</span>
              <h2 className="ch-title">God is Working Wonders</h2>
              <p className="ch-subtitle">
                Praise reports of salvation, divine healing, and breakthrough from participants.
              </p>
            </div>

            <div className="ch-grid-3">
              {[
                {
                  id: "t-1",
                  author: "Mary Wanjiku",
                  location: "Nyeri, Kenya",
                  testimony:
                    "I attended the Revival Conference carrying a burden of illness for over 3 years. During prayer, the power of God hit me, and I was instantly healed!",
                  category: "Divine Healing",
                },
                {
                  id: "t-2",
                  author: "Pastor Samuel K.",
                  location: "Uganda Mission",
                  testimony:
                    "The pastors' impartation seminar revitalized my prayer altar. Our local church has experienced an explosion of new believers since then.",
                  category: "Ministry Awakening",
                },
                {
                  id: "t-3",
                  author: "Grace Muthoni",
                  location: "Kirinyaga, Kenya",
                  testimony:
                    "The medical camp provided free treatment for my elderly mother, and our entire family gave our hearts to Jesus Christ that afternoon.",
                  category: "Salvation & Compassion",
                },
              ].map((testimony) => (
                <TestimonyCard
                  key={testimony.id}
                  id={testimony.id}
                  author={testimony.author}
                  location={testimony.location}
                  testimony={testimony.testimony}
                  category={testimony.category}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 10. Giving Call to Action */}
        <section className="ch-section ch-section-dark">
          <div className="ch-container" style={{ textAlign: "center", maxWidth: "760px" }}>
            <span className="ch-eyebrow">Partner With Us</span>
            <h2 className="ch-title" style={{ color: "#ffffff" }}>
              Partner With Us in the Work of God
            </h2>
            <p className="ch-subtitle" style={{ color: "#cbd5e1", marginBottom: "32px" }}>
              Your financial generosity empowers our team to preach the gospel in unreached places,
              stage revival crusades, dispense medical aid, and plant churches.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
              <a href="/give" className="ch-btn ch-btn-accent" style={{ padding: "16px 32px", fontSize: "16px" }}>
                Give to the Mission Now
              </a>
              <a href="/contact" className="ch-btn ch-btn-outline-white" style={{ padding: "16px 28px" }}>
                Contact for Partnership
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* 12. Footer */}
      <ChurchFooter
        ministryName={globalMissionConfig.ministryName}
        tagline={globalMissionConfig.tagline}
        phoneNumbers={globalMissionConfig.contact.phones}
        email={globalMissionConfig.contact.email}
        address={globalMissionConfig.contact.address}
        socialLinks={[
          { platform: "youtube", url: globalMissionConfig.social.youtube || "#" },
          { platform: "facebook", url: globalMissionConfig.social.facebook || "#" },
          { platform: "instagram", url: globalMissionConfig.social.instagram || "#" },
          { platform: "whatsapp", url: globalMissionConfig.social.whatsapp || "#" },
        ]}
      />

      {/* Video Modal Player */}
      <Modal
        isOpen={Boolean(activeVideo)}
        onClose={() => setActiveVideo(null)}
        title={activeVideo?.title}
      >
        {activeVideo?.youtubeVideoId && (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            <iframe
              src={`https://www.youtube.com/embed/${activeVideo.youtubeVideoId}?autoplay=1`}
              title={activeVideo.title}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0,
                borderRadius: "var(--church-radius)",
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
      </Modal>

      {/* Quick Event Registration Modal */}
      <Modal
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={`Register for ${selectedEvent?.title}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            alert("Registration received! You will receive a confirmation message shortly.");
            setSelectedEvent(null);
          }}
          style={{ display: "grid", gap: "16px" }}
        >
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. John Doe"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--church-border)",
                borderRadius: "var(--church-radius)",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Email Address *
            </label>
            <input
              type="email"
              required
              placeholder="e.g. john@example.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--church-border)",
                borderRadius: "var(--church-radius)",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Telephone / WhatsApp *
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. +254 712 345 678"
              style={{
                width: "100%",
                padding: "10px 12px",
                border: "1px solid var(--church-border)",
                borderRadius: "var(--church-radius)",
              }}
            />
          </div>
          <button type="submit" className="ch-btn ch-btn-accent" style={{ marginTop: "8px" }}>
            Complete Free Registration
          </button>
        </form>
      </Modal>
    </>
  );
}
