import { AcceptInvitationForm } from "./accept-invitation-form";

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ invitationId?: string }>;
}) {
  const { invitationId } = await searchParams;
  if (!invitationId || invitationId.length > 160) {
    return (
      <main className="shell">
        <div className="auth-page"><section className="auth-card"><h1>Invitation link is invalid.</h1><p className="auth-intro">Ask your organization administrator to send a new invitation.</p></section></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <nav className="nav"><a className="brand" href="/">BAZION<span>WEB</span></a><span className="nav-tag">CLIENT INVITATION</span></nav>
      <div className="auth-page"><AcceptInvitationForm invitationId={invitationId} /></div>
    </main>
  );
}
