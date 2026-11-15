"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  // Read localStorage only on the client, after hydration, to avoid SSR mismatch
  useEffect(() => {
    if (!localStorage.getItem("bmi_cookie_consent")) {
      const id = setTimeout(() => setIsVisible(true), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem("bmi_cookie_consent", "true");
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      background: "#0f172a",
      color: "#fff",
      padding: "1rem 2rem",
      zIndex: 9999,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: "1rem",
      flexWrap: "wrap",
      borderTop: "3px solid #d4af37",
      boxShadow: "0 -4px 20px rgba(0,0,0,0.15)"
    }}>
      <p style={{ margin: 0, fontSize: "0.9rem", color: "rgba(255,255,255,0.8)", lineHeight: 1.5, flex: "1 1 500px" }}>
        We use cookies to enhance your browsing experience and analyze site traffic. By continuing to use our site, you consent to our use of cookies as described in our <Link href="/privacy" style={{ color: "#d4af37", textDecoration: "underline", fontWeight: 600 }}>Privacy Policy</Link>.
      </p>
      <button 
        onClick={acceptCookies}
        style={{
          background: "#d4af37",
          color: "#0f172a",
          border: "none",
          padding: "0.6rem 1.5rem",
          borderRadius: "6px",
          fontWeight: 700,
          fontFamily: "'Outfit', sans-serif",
          cursor: "pointer",
          transition: "background 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "#e6c354"}
        onMouseLeave={(e) => e.currentTarget.style.background = "#d4af37"}
      >
        Accept & Close
      </button>
    </div>
  );
}
