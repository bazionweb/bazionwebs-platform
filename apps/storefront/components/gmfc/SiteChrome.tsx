"use client";

import { UtilityNav } from "./UtilityNav";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function SiteChrome({
  currentPath,
  children,
}: {
  currentPath?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="gmfci-site-root">
      <UtilityNav />
      <Navbar currentPath={currentPath} />
      {children}
      <Footer />
    </div>
  );
}

export default SiteChrome;

