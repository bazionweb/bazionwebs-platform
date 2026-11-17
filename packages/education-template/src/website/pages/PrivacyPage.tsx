export default function PrivacyPage() {
  return (
    <main id="main-content" style={{ background: "#fff", minHeight: "100vh", padding: "9.5rem 2rem 6rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "clamp(2rem, 4vw, 3.2rem)", color: "#0f172a", marginBottom: "1.5rem" }}>
          Privacy Policy
        </h1>
        <div className="gold-bar" style={{ marginBottom: "2.5rem" }} />
        
        <div style={{ color: "#475569", fontSize: "1.05rem", lineHeight: 1.8, display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <p><em>Last Updated: {new Date().toLocaleDateString()}</em></p>
          
          <p>
            At BMI University, we are committed to protecting the privacy and security of our students, prospective students, and website visitors. This Privacy Policy outlines how we collect, use, protect, and handle your Personally Identifiable Information (PII) in accordance with our website.
          </p>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#0f172a", marginTop: "1rem" }}>1. Information We Collect</h2>
          <p>
            We collect information from you when you fill out a form, apply for admission, subscribe to a newsletter, or enter information on our site. This may include your name, email address, phone number, mailing address, educational history, and other details necessary to process your application or inquiry.
          </p>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#0f172a", marginTop: "1rem" }}>2. How We Use Your Information</h2>
          <p>
            We may use the information we collect from you in the following ways:
          </p>
          <ul style={{ paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li>To process and evaluate your application for admission.</li>
            <li>To respond to your customer service requests and inquiries.</li>
            <li>To send periodic emails regarding your application, upcoming events, or other institutional news.</li>
            <li>To improve our website in order to better serve you.</li>
          </ul>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#0f172a", marginTop: "1rem" }}>3. Data Security & Third-Party Disclosure</h2>
          <p>
            Your personal information is contained behind secured networks and is only accessible by a limited number of persons who have special access rights to such systems, and are required to keep the information confidential. We do not sell, trade, or otherwise transfer to outside parties your Personally Identifiable Information unless we provide users with advance notice.
          </p>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#0f172a", marginTop: "1rem" }}>4. Use of Cookies</h2>
          <p>
            We use cookies to help us compile aggregate data about site traffic and site interaction so that we can offer better site experiences and tools in the future. You can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies through your browser settings.
          </p>

          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1.5rem", color: "#0f172a", marginTop: "1rem" }}>5. Contact Us</h2>
          <p>
            If there are any questions regarding this privacy policy, you may contact us using the information below:
            <br /><br />
            <strong>BMI University</strong><br />
            admin@bmiuniversities.org<br />
            704-607-5540
          </p>
        </div>
      </div>
    </main>
  );
}
