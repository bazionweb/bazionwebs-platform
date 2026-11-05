import { AuthPanel } from "./auth-panel";

export default function LoginPage() {
  return (
    <main className="shell">
      <nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">IDENTITY DEMO</span></nav>
      <div className="auth-page"><AuthPanel /></div>
    </main>
  );
}
