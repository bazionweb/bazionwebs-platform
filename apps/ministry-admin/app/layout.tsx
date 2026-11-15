import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./recovery.css";
import "./admin-shell.css";
import "@bazion/ui/tokens.css";
import "@bazion/ui/primitives.css";
import "@bazion/ui/navigation.css";
import "@bazion/ui/church.css";
import "@bazion/ui/pulse.css";
import { PulseHost } from "@bazion/ui";

const plusJakartaSans = localFont({
  src: "../../../packages/ui/assets/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

const inter = localFont({
  src: "../../../packages/ui/assets/fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const outfit = localFont({
  src: "../../../packages/ui/assets/fonts/outfit-latin.woff2",
  variable: "--font-outfit",
  weight: "100 900",
  display: "swap",
  preload: false,
});

const fraunces = localFont({
  src: [
    {
      path: "../../../packages/ui/assets/fonts/fraunces-latin.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../../../packages/ui/assets/fonts/fraunces-latin-italic.woff2",
      weight: "100 900",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Ministry Operations Console | Bazion Web",
    template: "%s | Ministry Operations Console",
  },
  description:
    "Dedicated church staff administration for website publishing, departments, life groups, volunteer teams, and physical inventory.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${inter.variable} ${outfit.variable} ${fraunces.variable}`}
    >
      <body>
        {children}
        <PulseHost position="top-right" />
      </body>
    </html>
  );
}
