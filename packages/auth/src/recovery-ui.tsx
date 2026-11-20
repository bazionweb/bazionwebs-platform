"use client";

import { useEffect, useState, useCallback } from "react";
import type { FormEvent } from "react";
import { requestPasswordReset, resetPassword } from "./client.js";
import { pulse } from "@bazion/ui";

type RecoveryVariant = "tenant" | "platform";

const SESSION_TOKEN_KEY = "bazion_password_reset_token";

function recoveryClass(variant: RecoveryVariant, part: "card" | "form" | "input" | "button"): string {
  if (variant === "platform") {
    return ({ card: "login-card recovery-card", form: "recovery-form", input: "recovery-input", button: "primary" })[part];
  }
  return ({ card: "auth-card recovery-card", form: "recovery-form", input: "recovery-input", button: "checkout-button" })[part];
}

function parseTokenFromInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get("token") ?? trimmed;
  } catch {
    return trimmed;
  }
}

export function PasswordResetRequestForm({ variant = "tenant" }: { variant?: RecoveryVariant }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSend = useCallback(async (targetEmail: string) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail) return;

    setBusy(true);
    setError("");

    try {
      const callback = new URL("/reset-password", window.location.origin).toString();
      await pulse.track(
        async () => {
          const result = await requestPasswordReset(cleanEmail, callback);
          if (result === "rate-limited") {
            throw new Error("Too many reset requests were made. Wait an hour before trying again.");
          }
          return result;
        },
        {
          pending: "Sending reset link…",
          pendingDetail: `Connecting to secure notification worker for ${cleanEmail}…`,
          success: "Password reset link sent",
          successDetail: `A secure reset link has been dispatched to ${cleanEmail}. Check your inbox and spam folder.`,
          scope: "Account Recovery",
        },
      );

      setSentEmail(cleanEmail);
      setCooldown(60);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "The reset request could not be sent. Please try again later.";
      setError(msg);
      pulse.error(reason, {
        title: "Could not send reset link",
        detail: msg,
        scope: "Account Recovery",
      });
    } finally {
      setBusy(false);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleSend(email);
  }

  if (sentEmail) {
    return (
      <section className={recoveryClass(variant, "card")}>
        <div className="recovery-header">
          <span className="recovery-badge success">✓ DISPATCHED</span>
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h1>Check your email</h1>
        </div>

        <div className="delivery-notice-card" role="status">
          <div className="delivery-indicator">
            <span className="delivery-dot pulse"></span>
            <strong>Email sent to:</strong>
            <span className="delivery-email">{sentEmail}</span>
          </div>
          <p className="delivery-desc">
            Our notification service has dispatched a single-use password reset link to your email address.
          </p>
          <ul className="delivery-checklist">
            <li>Click the <strong>Reset Password</strong> button in the email to choose a new password.</li>
            <li>The reset link remains valid for <strong>60 minutes</strong>.</li>
            <li>If you don’t see the email within a couple minutes, check your <strong>spam</strong> or junk folder.</li>
          </ul>
        </div>

        <div className="recovery-actions">
          <button
            type="button"
            className={recoveryClass(variant, "button")}
            disabled={busy || cooldown > 0}
            onClick={() => handleSend(sentEmail)}
          >
            {busy ? "Resending…" : cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend reset link"}
          </button>
          <button
            type="button"
            className="text-link-button"
            onClick={() => {
              setSentEmail(null);
              setError("");
            }}
          >
            Use a different email address
          </button>
        </div>

        <p className="recovery-footer-link">
          <a href="/login">Back to sign in</a>
        </p>
      </section>
    );
  }

  return (
    <section className={recoveryClass(variant, "card")}>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1>Reset your password</h1>
      <p className="muted">
        Enter the email address for your account. We’ll send a secure, single-use reset link right away.
      </p>

      <form className={recoveryClass(variant, "form")} onSubmit={submit}>
        <label>
          Email address
          <input
            className={recoveryClass(variant, "input")}
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className={recoveryClass(variant, "button")} type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </button>
      </form>

      {error && <p className="error" role="alert">{error}</p>}
      <p className="recovery-footer-link">
        <a href="/login">Back to sign in</a>
      </p>
    </section>
  );
}

export function PasswordResetForm({ variant = "tenant" }: { variant?: RecoveryVariant }) {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Zero-hassle manual token or fresh link request when arriving without token in URL
  const [manualInput, setManualInput] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [requestSentTo, setRequestSentTo] = useState<string | null>(null);
  const [requestBusy, setRequestBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const urlToken = (url.searchParams.get("token") || hashParams.get("token"))?.trim() ?? "";
    const invalidToken = url.searchParams.get("error") === "INVALID_TOKEN" || hashParams.get("error") === "INVALID_TOKEN";

    if (invalidToken) {
      setError("This reset link is invalid or has expired. Request a new link below to continue.");
      pulse.error("This reset link is invalid or has expired.", {
        title: "Reset link expired",
        scope: "Account Recovery",
      });
    }

    if (urlToken) {
      setToken(urlToken);
      try {
        window.sessionStorage.setItem(SESSION_TOKEN_KEY, urlToken);
      } catch {}
      // Clean query params & hash so tokens aren't stored in browser history or referrer headers
      url.searchParams.delete("token");
      url.searchParams.delete("error");
      hashParams.delete("token");
      hashParams.delete("error");
      const cleanHash = hashParams.toString();
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${cleanHash ? `#${cleanHash}` : ""}`);
    } else {
      // Fallback to active token in current browser session so page reload doesn't break form
      try {
        const stored = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
        if (stored) {
          setToken(stored.trim());
        }
      } catch {}
    }
  }, []);

  const handleManualTokenSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const extracted = parseTokenFromInput(manualInput);
    if (!extracted) {
      setError("Please paste a valid reset token or link.");
      return;
    }
    setError("");
    setToken(extracted);
    try {
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, extracted);
    } catch {}
    pulse.info("Reset token captured. Enter your new password below.", { scope: "Account Recovery" });
  };

  const handleInlineResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanEmail = requestEmail.trim();
    if (!cleanEmail) return;

    setRequestBusy(true);
    setError("");

    try {
      const callback = new URL("/reset-password", window.location.origin).toString();
      await pulse.track(
        async () => {
          const result = await requestPasswordReset(cleanEmail, callback);
          if (result === "rate-limited") {
            throw new Error("Too many reset requests were made. Wait an hour before trying again.");
          }
          return result;
        },
        {
          pending: "Sending reset link…",
          pendingDetail: `Connecting to secure notification worker for ${cleanEmail}…`,
          success: "Password reset link sent",
          successDetail: `A secure reset link has been dispatched to ${cleanEmail}. Check your inbox and spam folder.`,
          scope: "Account Recovery",
        },
      );
      setRequestSentTo(cleanEmail);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "The reset request could not be sent. Please try again later.";
      setError(msg);
      pulse.error(reason, {
        title: "Could not send reset link",
        detail: msg,
        scope: "Account Recovery",
      });
    } finally {
      setRequestBusy(false);
    }
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!token) {
      setError("This reset link is missing or expired. Request a new link to continue.");
      return;
    }
    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("Password must be between 12 and 128 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords do not match. Please verify both fields.");
      return;
    }

    setBusy(true);
    try {
      await pulse.track(
        async () => {
          await resetPassword(token, newPassword);
        },
        {
          pending: "Updating password…",
          pendingDetail: "Validating reset token and updating credentials…",
          success: "Password updated successfully",
          successDetail: "Your account is secure. You can now sign in with your new password.",
          scope: "Account Recovery",
        },
      );

      try {
        window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
      } catch {}

      setToken("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (reason) {
      const msg = reason instanceof Error ? reason.message : "The password could not be changed.";
      setError(msg);
      pulse.error(reason, {
        title: "Password update failed",
        detail: msg,
        scope: "Account Recovery",
      });
    } finally {
      setBusy(false);
    }
  }

  // Success view
  if (success) {
    return (
      <section className={recoveryClass(variant, "card")}>
        <div className="recovery-header">
          <span className="recovery-badge success">✓ UPDATED</span>
          <p className="eyebrow">ACCOUNT RECOVERY</p>
          <h1>Password changed!</h1>
        </div>

        <div className="delivery-notice-card success-card" role="status">
          <p className="delivery-desc">
            Your password has been changed securely. All existing sessions have been refreshed.
          </p>
          <p className="muted" style={{ margin: "10px 0 0" }}>
            You can now sign in to your Bazion Web account with your new password.
          </p>
        </div>

        <div className="recovery-actions">
          <a href="/login" className={recoveryClass(variant, "button")} style={{ textAlign: "center", textDecoration: "none" }}>
            Sign in with new password
          </a>
        </div>
      </section>
    );
  }

  // Token is active: render password inputs
  if (token) {
    const isLengthValid = newPassword.length >= 12 && newPassword.length <= 128;
    const isMatch = newPassword.length > 0 && newPassword === confirmPassword;

    return (
      <section className={recoveryClass(variant, "card")}>
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a new password</h1>
        <p className="muted">
          Use at least 12 characters. After the change, you’ll need to sign in with your new password.
        </p>

        <form className={recoveryClass(variant, "form")} onSubmit={submit}>
          <label>
            New password
            <div className="password-input-wrapper">
              <input
                className={recoveryClass(variant, "input")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={newPassword}
                placeholder="At least 12 characters"
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <button
                type="button"
                className="password-toggle-btn"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label>
            Confirm new password
            <div className="password-input-wrapper">
              <input
                className={recoveryClass(variant, "input")}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
                value={confirmPassword}
                placeholder="Repeat new password"
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
          </label>

          <div className="password-requirements">
            <span className={`requirement-chip ${isLengthValid ? "valid" : ""}`}>
              {isLengthValid ? "✓" : "○"} 12+ characters
            </span>
            <span className={`requirement-chip ${isMatch ? "valid" : ""}`}>
              {isMatch ? "✓" : "○"} Passwords match
            </span>
          </div>

          <button className={recoveryClass(variant, "button")} type="submit" disabled={busy || !isLengthValid || !isMatch}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>

        {error && <p className="error" role="alert">{error}</p>}

        <p className="recovery-footer-link">
          <button
            type="button"
            className="text-link-button"
            onClick={() => {
              setToken("");
              try {
                window.sessionStorage.removeItem(SESSION_TOKEN_KEY);
              } catch {}
            }}
          >
            Use a different token or request fresh link
          </button>
        </p>
      </section>
    );
  }

  // Zero-hassle fallback when no token exists in URL or session:
  // Allow user to paste token or request fresh link immediately right on this page!
  return (
    <section className={recoveryClass(variant, "card")}>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1>Choose a new password</h1>
      <p className="muted">
        To set a new password, open the link sent to your email, or use the instant options below.
      </p>

      {requestSentTo ? (
        <div className="delivery-notice-card" role="status" style={{ margin: "20px 0" }}>
          <div className="delivery-indicator">
            <span className="delivery-dot pulse"></span>
            <strong>Reset link dispatched to:</strong>
            <span className="delivery-email">{requestSentTo}</span>
          </div>
          <p className="delivery-desc">
            Check your inbox and spam folder. Click <strong>Reset Password</strong> in that email or paste the one-time token below.
          </p>
        </div>
      ) : null}

      <div className="zero-hassle-sections">
        {/* Section 1: Paste token or link */}
        <div className="zero-hassle-box">
          <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px" }}>
            Have a reset token or link from your email?
          </h2>
          <form className="recovery-inline-form" onSubmit={handleManualTokenSubmit}>
            <input
              className={recoveryClass(variant, "input")}
              type="text"
              placeholder="Paste reset token or link from email"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
            />
            <button type="submit" className={recoveryClass(variant, "button")} disabled={!manualInput.trim()}>
              Continue
            </button>
          </form>
        </div>

        <div className="zero-hassle-divider">
          <span>OR</span>
        </div>

        {/* Section 2: Request fresh link right here */}
        <div className="zero-hassle-box">
          <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 8px" }}>
            Need a fresh reset link?
          </h2>
          <form className="recovery-inline-form" onSubmit={handleInlineResetRequest}>
            <input
              className={recoveryClass(variant, "input")}
              type="email"
              placeholder="Enter your account email"
              value={requestEmail}
              required
              onChange={(e) => setRequestEmail(e.target.value)}
            />
            <button type="submit" className={recoveryClass(variant, "button")} disabled={requestBusy || !requestEmail.trim()}>
              {requestBusy ? "Sending…" : "Send link"}
            </button>
          </form>
        </div>
      </div>

      {error && <p className="error" role="alert" style={{ marginTop: "16px" }}>{error}</p>}

      <p className="recovery-footer-link" style={{ marginTop: "20px" }}>
        <a href="/login">Back to sign in</a>
      </p>
    </section>
  );
}
