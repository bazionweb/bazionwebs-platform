import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bazion Demo Store",
  description: "A starter storefront powered by the Bazion Web Platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
