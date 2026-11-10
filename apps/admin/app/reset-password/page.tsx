import type { Metadata } from "next";
import Link from "next/link";
import { PasswordResetForm } from "@bazion/auth/recovery-ui";

export const metadata: Metadata = {
  title: "Reset password | Bazion Control",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return <main className="login-shell">
    <Link className="wordmark" href="/">BAZION<span> / CONTROL</span></Link>
    <PasswordResetForm variant="platform" />
  </main>;
}
