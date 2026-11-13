"use client";

import { useState } from "react";
import { pulse } from "@bazion/ui";
import { authClient } from "@bazion/auth/client";

export function AcceptInvitationForm({ invitationId }: { invitationId: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function accept() {
    setBusy(true);
    setMessage("");
    try {
      await pulse.track(
        async () => {
          const result = await authClient.organization.acceptInvitation({ invitationId });
          if (result.error) throw new Error(result.error.message ?? "Invitation could not be accepted.");
          setMessage("Invitation accepted. Your client organization membership is now active.");
          return result;
        },
        {
          pending: "Accepting invitation…",
          success: "Invitation accepted! Organization membership active.",
          scope: "invitation",
        },
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  if (isPending) return <section className="auth-card"><p>Checking your session…</p></section>;
  if (!session) {
    const returnPath = `/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
    return (
      <section className="auth-card">
        <p className="eyebrow">CLIENT INVITATION</p>
        <h1>Sign in to continue.</h1>
        <p className="auth-intro">Sign in with the email address this invitation was sent to, then return here to accept it.</p>
        <a className="checkout-button" href={`/login?callbackURL=${encodeURIComponent(returnPath)}`}>Sign in and continue →</a>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">CLIENT INVITATION</p>
      <h1>Join your client workspace.</h1>
      <p className="auth-intro">You are signed in as {session.user.email}. Accepting this invitation adds you to the organization with the role selected by its administrator.</p>
      <button className="checkout-button" type="button" disabled={busy} onClick={accept}>{busy ? "Accepting…" : "Accept invitation →"}</button>
      {message && <p className="notice" role="status">{message}</p>}
    </section>
  );
}
