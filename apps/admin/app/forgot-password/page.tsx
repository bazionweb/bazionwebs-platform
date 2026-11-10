import Link from "next/link";
import { PasswordResetRequestForm } from "@bazion/auth/recovery-ui";

export default function ForgotPasswordPage() {
  return <main className="login-shell">
    <Link className="wordmark" href="/">BAZION<span> / CONTROL</span></Link>
    <PasswordResetRequestForm variant="platform" />
  </main>;
}
