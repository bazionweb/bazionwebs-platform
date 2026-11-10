import { PasswordResetRequestForm } from "@bazion/auth/recovery-ui";

export default function ForgotPasswordPage() {
  return <main className="shell">
    <nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">ACCOUNT RECOVERY</span></nav>
    <div className="auth-page"><PasswordResetRequestForm /></div>
  </main>;
}
