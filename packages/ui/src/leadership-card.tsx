export interface LeadershipCardProps {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photoUrl?: string;
}

export function LeadershipCard({ name, role, bio, photoUrl }: LeadershipCardProps) {
  return (
    <article className="ch-card">
      <div
        className="ch-card-media"
        style={{ aspectRatio: "1 / 1", backgroundColor: "var(--church-bg-muted)" }}
      >
        <img
          src={photoUrl || "/images/leader-placeholder.jpg"}
          alt={name}
          loading="lazy"
        />
      </div>
      <div className="ch-card-body" style={{ textAlign: "center" }}>
        <h3 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 6px 0", color: "var(--church-primary)" }}>
          {name}
        </h3>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--church-accent)", marginBottom: "12px" }}>
          {role}
        </div>
        {bio && (
          <p style={{ fontSize: "14px", color: "var(--church-text-muted)", lineHeight: 1.6, margin: 0 }}>
            {bio}
          </p>
        )}
      </div>
    </article>
  );
}
