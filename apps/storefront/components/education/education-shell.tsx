import React from "react";
import { BmiNavbar, BmiFooter, BmiCookieBanner } from "@bazion/education-template";

export function EducationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="education-site-root">
      <link rel="stylesheet" href="/styles/bmi-website.css" />
      <style>{`
        .education-site-root {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          background-color: #0b1528;
          color: #ffffff;
          font-family: 'Plus Jakarta Sans', sans-serif;
          isolation: isolate;
        }
        .education-site-root footer,
        .education-site-root .bmi-footer {
          display: block !important;
          width: 100% !important;
          border-top: none !important;
          padding: 0 !important;
          margin: 0 !important;
          font-family: 'Plus Jakarta Sans', sans-serif !important;
          font-size: inherit !important;
          letter-spacing: normal !important;
          color: #ffffff !important;
          box-sizing: border-box !important;
        }
        .education-site-root .footer-grid {
          display: grid !important;
          width: 100% !important;
          max-width: 1280px !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
        }
        .education-site-root .footer-bottom-bar {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
      `}</style>
      <BmiNavbar />
      <div className="education-content-wrapper">{children}</div>
      <BmiCookieBanner />
      <BmiFooter />
    </div>
  );
}
