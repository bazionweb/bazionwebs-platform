"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { pulse } from "@bazion/ui";
import { authClient, resolveSafeRedirectTarget } from "@bazion/auth/client";

function getSafeCallbackUrl(): string {
  const safePathOrUrl = resolveSafeRedirectTarget(
    new URLSearchParams(window.location.search).get("callbackURL"),
    { allowedOrigins: [window.location.origin], fallback: "/workspace" },
  );
  return new URL(safePathOrUrl, window.location.origin).toString();
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
      await pulse.track(
        async () => {
          if (mode === "sign-up") {
            const result = await authClient.signUp.email({ name, email, password, callbackURL: getSafeCallbackUrl() });
            if (result.error) throw new Error(result.error.message ?? "Account creation failed.");
            setMessage("Account created. We’re sending a verification link; check your inbox and spam folder.");
            return result;
          } else {
            const callbackURL = getSafeCallbackUrl();
            const result = await authClient.signIn.email({ email, password, callbackURL });
            if (result.error) throw new Error(result.error.message ?? "Sign-in failed.");
            window.location.assign(callbackURL);
            return result;
          }
        },
        {
          pending: mode === "sign-up" ? "Creating account…" : "Signing in…",
          success: mode === "sign-up" ? "Verification email queued" : "Signed in securely",
          scope: "auth",
        },
      );
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
      {mode === "sign-in" && <a className="auth-toggle" href="/forgot-password">Forgot your password?</a>}
      <button className="auth-toggle" type="button" onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setMessage(""); }}>
        {mode === "sign-in" ? "Need an account? Create one" : "Already registered? Sign in"}
      </button>
      {message && <p className="notice" role="status">{message}</p>}
    </section>
  );
}
