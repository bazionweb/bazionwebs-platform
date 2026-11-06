"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Sign-in failed.");
      router.replace("/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally { setBusy(false); }
  }

  return <main className="login-shell"><Link className="wordmark" href="/">BAZION<span> / CONTROL</span></Link><section className="login-card"><p className="eyebrow">PLATFORM OPERATOR ACCESS</p><h1>Sign in</h1><p className="muted">Use your platform operator account. Tenant workspace roles do not grant platform access.</p>
    <form onSubmit={submit}><label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in securely →"}</button></form>
    {error && <p className="error" role="alert">{error}</p>}<p className="security">Authentication is handled by Better Auth. Platform permissions are enforced by the API on every request.</p>
  </section></main>;
}
