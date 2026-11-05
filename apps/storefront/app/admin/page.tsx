import { AdminDashboard } from "./admin-dashboard";

export default function AdminPage() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="/">BAZION<span>WEB</span></a>
        <span className="nav-tag">CLIENT WORKSPACE</span>
        <a className="cart-nav" href="/workspace">Switch workspace ↗</a>
      </nav>
      <div className="admin-page"><AdminDashboard /></div>
      <footer><span>BAZION WEB PLATFORM</span><span>Client data stays within its tenant boundary.</span></footer>
    </main>
  );
}
