import type { Metadata } from "next";
import "./globals.css";
import "@bazion/ui/church.css";

export const metadata: Metadata = {
  title: "Global Mission for Christ International – Propagating Revival to the Nations",
  description:
    "Official digital ministry platform for Global Mission for Christ International. Watch sermons, view upcoming conferences, register for medical outreaches, and partner with the ministry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
