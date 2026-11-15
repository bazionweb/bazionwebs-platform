import type { Metadata } from "next";
import localFont from "next/font/local";
import { PulseHost } from "@bazion/ui";
import "@bazion/ui/pulse.css";
import "./globals.css";
import "./recovery.css";
import "./font-fallbacks.css";

const plusJakartaSans = localFont({
  src: "../../../packages/ui/assets/fonts/plus-jakarta-sans-latin.woff2",
  variable: "--font-plus-jakarta",
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

export const metadata: Metadata = {
  title: "Bazion Control | Platform",
  description: "Bazion platform operations and tenant management.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${inter.variable}`}>
      <body>
        {children}
        <PulseHost position="bottom-right" />
      </body>
    </html>
  );
}
