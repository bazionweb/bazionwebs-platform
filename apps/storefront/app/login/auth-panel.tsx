"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { authClient } from "@bazion/auth/client";

function getSafeCallbackUrl(): string {
  const requested = new URLSearchParams(window.location.search).get("callbackURL");
  if (!requested) return new URL("/workspace", window.location.origin).toString();
  try {
    const destination = new URL(requested, window.location.origin);
    return destination.origin === window.location.origin
      ? destination.toString()
      : new URL("/workspace", window.location.origin).toString();
  } catch {
    return new URL("/workspace", window.location.origin).toString();
  }
}

export function AuthPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({ name, email, password, callbackURL: getSafeCallbackUrl() });
        if (result.error) throw new Error(result.error.message ?? "Account creation failed.");
        setMessage("Account created. Follow the verification link sent by email or printed in the local API console.");
      } else {
        const result = await authClient.signIn.email({ email, password, callbackURL: "/" });
        if (result.error) throw new Error(result.error.message ?? "Sign-in failed.");
        setMessage("Signed in. Your session is held in an HttpOnly cookie.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">BAZION IDENTITY</p>
      <h1>{mode === "sign-in" ? "Welcome back." : "Create your account."}</h1>
      <p className="auth-intro">Self-hosted Better Auth powers sign-in. Client organizations and their permissions are provisioned separately by Bazion administrators.</p>
      <form onSubmit={submit}>
        {mode === "sign-up" && (
          <label>Full name<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        )}
        <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Password<input required type="password" minLength={12} maxLength={128} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="checkout-button" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "sign-in" ? "Sign in →" : "Create account →"}</button>
      </form>
      <button className="auth-toggle" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>
        {mode === "sign-in" ? "Need an account? Create one" : "Already registered? Sign in"}
      </button>
      {message && <p className="notice" role="status">{message}</p>}
    </section>
  );
}
