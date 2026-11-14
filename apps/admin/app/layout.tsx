import type { Metadata } from "next";
import { PulseHost } from "@bazion/ui";
import "@bazion/ui/pulse.css";
import "./globals.css";
import "./recovery.css";
import "./font-fallbacks.css";

export const metadata: Metadata = {
  title: "Bazion Control | Platform",
  description: "Bazion platform operations and tenant management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <PulseHost position="bottom-right" />
      </body>
    </html>
  );
}
