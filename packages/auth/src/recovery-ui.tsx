"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { requestPasswordReset, resetPassword } from "./client.js";

type RecoveryVariant = "tenant" | "platform";

function recoveryClass(variant: RecoveryVariant, part: "card" | "form" | "input" | "button"): string {
  if (variant === "platform") {
    return ({ card: "login-card recovery-card", form: "recovery-form", input: "recovery-input", button: "primary" })[part];
  }
  return ({ card: "auth-card recovery-card", form: "recovery-form", input: "recovery-input", button: "checkout-button" })[part];
}

export function PasswordResetRequestForm({ variant = "tenant" }: { variant?: RecoveryVariant }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const callback = new URL("/reset-password", window.location.origin).toString();
      const result = await requestPasswordReset(email.trim(), callback);
      setMessage(result === "rate-limited"
        ? "Too many reset requests were made. Wait an hour before trying again."
        : "If an account uses that email, a reset link is on its way. Check your inbox and spam folder.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The reset request could not be sent. Please try again later.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={recoveryClass(variant, "card")}>
    <p className="eyebrow">ACCOUNT RECOVERY</p>
    <h1>Reset your password</h1>
    <p className="muted">Enter the email address for your account. We’ll send a secure link if it matches an account.</p>
    <form className={recoveryClass(variant, "form")} onSubmit={submit}>
      <label>Email address<input className={recoveryClass(variant, "input")} type="email" name="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button className={recoveryClass(variant, "button")} type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</button>
    </form>
    {message && <p className="recovery-message" role="status">{message}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <p><a href="/login">Back to sign in</a></p>
  </section>;
}

export function PasswordResetForm({ variant = "tenant" }: { variant?: RecoveryVariant }) {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const resetToken = url.searchParams.get("token") ?? "";
    const invalidToken = url.searchParams.get("error") === "INVALID_TOKEN";
    setToken(resetToken);
    if (invalidToken) setError("This reset link is invalid or has expired. Request a new link to continue.");
    // Remove the bearer token from the address bar and browser history as soon as
    // the page has captured it. The page also sends Referrer-Policy: no-referrer.
    if (url.searchParams.has("token") || url.searchParams.has("error")) {
      url.searchParams.delete("token");
      url.searchParams.delete("error");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!token) {
      setError("This reset link is missing or expired. Request a new link to continue.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Choose a password between 12 and 128 characters.");
      return;
    }

    setBusy(true);
    try {
      await resetPassword(token, newPassword);
      setToken("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Your password has been changed. Sign in with your new password.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The password could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className={recoveryClass(variant, "card")}>
    <p className="eyebrow">ACCOUNT RECOVERY</p>
    <h1>Choose a new password</h1>
    <p className="muted">Use at least 12 characters. After the change, you’ll need to sign in again on your devices.</p>
    {message ? <p className="recovery-message" role="status">{message}</p> : token ? <form className={recoveryClass(variant, "form")} onSubmit={submit}>
      <label>New password<input className={recoveryClass(variant, "input")} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
      <label>Confirm new password<input className={recoveryClass(variant, "input")} type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      <button className={recoveryClass(variant, "button")} type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form> : <p className="muted" role="status">Open the reset link from your email. If it has expired, request a new one.</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {message ? <p><a href="/login">Go to sign in</a></p> : <p><a href="/forgot-password">Request a new reset link</a></p>}
  </section>;
}
