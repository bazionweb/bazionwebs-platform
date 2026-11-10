import type { Metadata } from "next";
import "./globals.css";
import "./recovery.css";

export const metadata: Metadata = {
  title: "Bazion Control | Platform",
  description: "Bazion platform operations and tenant management.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
