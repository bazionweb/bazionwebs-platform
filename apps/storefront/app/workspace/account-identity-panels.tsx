"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

type Props = {
  currentEmail: string;
  emailVerified: boolean;
  onOrderClaimed: () => void;
};

type ApiErrorBody = {
  error?: string;
  message?: string;
  collisionId?: string;
};

/**
 * Self-service account identity actions inside the authenticated workspace:
 * 1) Explicit atomic claim of a guest-paid commercial order using a one-time proof token.
 * 2) Verified account email change request + confirmation without silent account merging.
 */
export function AccountIdentityPanels({ currentEmail, emailVerified, onOrderClaimed }: Props) {
  const [claimHintOpen, setClaimHintOpen] = useState(false);
  const [proofToken, setProofToken] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimNotice, setClaimNotice] = useState("");
  const [claimError, setClaimError] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [confirmToken, setConfirmToken] = useState("");
  const [emailChangeRequested, setEmailChangeRequested] = useState(false);
  const [emailExpiresAt, setEmailExpiresAt] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const claimFlag = new URLSearchParams(window.location.search).get("claim");
    if (claimFlag === "1" || claimFlag === "true") {
      setClaimHintOpen(true);
    }
  }, []);

  async function submitOrderClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimBusy(true);
    setClaimNotice("");
    setClaimError("");
    try {
      const response = await fetch("/v1/auth/claim-order", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proofToken: proofToken.trim() }),
      });
      const body = await response.json().catch(() => ({})) as ApiErrorBody & {
        claimed?: boolean;
        externalOrderId?: string;
        tenantId?: string;
        membershipRole?: string;
      };
      if (!response.ok) {
        const collisionNote = body.collisionId ? ` (Collision reference: ${body.collisionId})` : "";
        throw new Error(`${body.message ?? "Order claim failed."}${collisionNote}`);
      }
      setProofToken("");
      setClaimNotice(
        `Order ${body.externalOrderId ?? ""} claimed (${body.membershipRole ?? "member"}). Refreshing your workspace list…`,
      );
      onOrderClaimed();
    } catch (error) {
      setClaimError(error instanceof Error ? error.message : "Could not claim order.");
    } finally {
      setClaimBusy(false);
    }
  }

  async function submitEmailChangeRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailBusy(true);
    setEmailNotice("");
    setEmailError("");
    try {
      const response = await fetch("/v1/auth/email-change/request", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newEmail: newEmail.trim() }),
      });
      const body = await response.json().catch(() => ({})) as ApiErrorBody & {
        accepted?: boolean;
        newEmail?: string;
        expiresAt?: string;
      };
      if (!response.ok) {
        const collisionNote = body.collisionId ? ` (Conflict reference: ${body.collisionId})` : "";
        throw new Error(`${body.message ?? "Email change request failed."}${collisionNote}`);
      }
      setEmailChangeRequested(true);
      setEmailExpiresAt(body.expiresAt ?? null);
      setEmailNotice(
        `Verification token issued for ${body.newEmail ?? newEmail.trim()}. Enter the verification token below to finalize the change and re-authenticate.`,
      );
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Could not request email change.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function submitEmailChangeConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailBusy(true);
    setEmailNotice("");
    setEmailError("");
    try {
      const response = await fetch("/v1/auth/email-change/confirm", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: confirmToken.trim() }),
      });
      const body = await response.json().catch(() => ({})) as ApiErrorBody & {
        updated?: boolean;
        newEmail?: string;
        reauthenticationRequired?: boolean;
      };
      if (!response.ok) {
        const collisionNote = body.collisionId ? ` (Conflict reference: ${body.collisionId})` : "";
        throw new Error(`${body.message ?? "Email change confirmation failed."}${collisionNote}`);
      }
      setConfirmToken("");
      setEmailNotice(
        `Email updated to ${body.newEmail ?? "your new address"}. Active sessions were revoked; redirecting to sign in…`,
      );
      window.location.assign("/login?callbackURL=%2Fworkspace");
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : "Could not confirm email change.");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="workspace-tenant-area">
      <div className="workspace-tenant-heading">
        <div>
          <p className="eyebrow">IDENTITY &amp; SECURITY</p>
          <h2>Order claim &amp; verified email management</h2>
        </div>
        <p>
          Accounts are never merged silently by email. Claim guest checkouts with a one-time proof token or update your sign-in email explicitly.
        </p>
      </div>

      <div className="workspace-list">
        <article className="workspace-item">
          <div style={{ width: "100%" }}>
            <strong>Claim a paid commercial order {claimHintOpen ? "· ready" : ""}</strong>
            <small>
              Paste the one-time claim proof issued after checkout. Never share proof tokens in URLs or bookmarks.
            </small>
            {!emailVerified && (
              <p className="notice" role="status">
                Verify {currentEmail} before claiming an unlinked guest order.
              </p>
            )}
            <form onSubmit={submitOrderClaim} style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
              <input
                type="password"
                autoComplete="off"
                value={proofToken}
                onChange={(event) => setProofToken(event.target.value)}
                placeholder="Paste one-time order claim proof token"
                minLength={32}
                required
                aria-label="Order claim proof token"
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5d0" }}
              />
              <button
                className="workspace-select"
                type="submit"
                disabled={claimBusy || !emailVerified || proofToken.trim().length < 32}
              >
                {claimBusy ? "Claiming order…" : "Claim order workspace"}
              </button>
            </form>
            {claimNotice && <p className="notice" role="status">{claimNotice}</p>}
            {claimError && <p className="ministry-media-error" role="alert">{claimError}</p>}
          </div>
        </article>

        <article className="workspace-item">
          <div style={{ width: "100%" }}>
            <strong>Account sign-in email ({currentEmail})</strong>
            <small>
              Changing your email requires verification and revokes all active sessions across workspaces.
            </small>
            <form onSubmit={submitEmailChangeRequest} style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
              <input
                type="email"
                autoComplete="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="New email address"
                required
                aria-label="New account email address"
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5d0" }}
              />
              <button
                className="workspace-select"
                type="submit"
                disabled={emailBusy || !newEmail.trim()}
              >
                {emailBusy ? "Requesting…" : "Request email change"}
              </button>
            </form>

            {emailChangeRequested && (
              <form onSubmit={submitEmailChangeConfirm} style={{ display: "grid", gap: "8px", marginTop: "10px" }}>
                {emailExpiresAt && (
                  <small>Verification token expires at {new Date(emailExpiresAt).toLocaleString()}.</small>
                )}
                <input
                  type="password"
                  autoComplete="one-time-code"
                  value={confirmToken}
                  onChange={(event) => setConfirmToken(event.target.value)}
                  placeholder="Enter email change verification token"
                  minLength={32}
                  required
                  aria-label="Email change verification token"
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5d0" }}
                />
                <button
                  className="workspace-select"
                  type="submit"
                  disabled={emailBusy || confirmToken.trim().length < 32}
                >
                  {emailBusy ? "Confirming…" : "Confirm email change & re-authenticate"}
                </button>
              </form>
            )}

            {emailNotice && <p className="notice" role="status">{emailNotice}</p>}
            {emailError && <p className="ministry-media-error" role="alert">{emailError}</p>}
          </div>
        </article>
      </div>
    </div>
  );
}

