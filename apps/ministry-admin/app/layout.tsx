import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Outfit, Fraunces } from "next/font/google";
import "./globals.css";
import "./recovery.css";
import "./admin-shell.css";
import "@bazion/ui/tokens.css";
import "@bazion/ui/primitives.css";
import "@bazion/ui/navigation.css";
import "@bazion/ui/church.css";
import "@bazion/ui/pulse.css";
import { PulseHost } from "@bazion/ui";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Ministry Operations Console | Bazion Web",
    template: "%s | Ministry Operations Console",
  },
  description: "Dedicated church staff administration for website publishing, departments, life groups, volunteer teams, and physical inventory.",
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

