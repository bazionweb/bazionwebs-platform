import { WorkspacePicker } from "./workspace-picker";

export default function WorkspacePage() {
  return (
    <main className="shell">
      <nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">ADMINISTRATION ACCESS</span></nav>
      <div className="auth-page"><WorkspacePicker /></div>
    </main>
  );
}
