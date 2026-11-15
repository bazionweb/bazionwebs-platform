import React from "react";
import { BmiNavbar, BmiFooter, BmiCookieBanner } from "@bazion/education-template";

export function EducationShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="education-site-root">
      <link rel="stylesheet" href="/styles/bmi-website.css" />
      <BmiNavbar />
      <div className="education-content-wrapper">{children}</div>
      <BmiCookieBanner />
      <BmiFooter />
    </div>
  );
}

