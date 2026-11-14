import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { PulseHost } from "@bazion/ui";
import "@bazion/ui/pulse.css";
import "./globals.css";
import "./recovery.css";
import "./font-fallbacks.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
