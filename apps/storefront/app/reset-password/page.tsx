import type { Metadata } from "next";
import { PasswordResetForm } from "@bazion/auth/recovery-ui";

export const metadata: Metadata = {
  title: "Reset password | Bazion Web",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <main className="shell">
    <nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">ACCOUNT RECOVERY</span></nav>
    <div className="auth-page"><PasswordResetForm /></div>
  </main>;
}
