export interface LeadershipCardProps {
  id: string;
  name: string;
  role: string;
  bio?: string;
  photoUrl?: string;
}

export function LeadershipCard({ name, role, bio, photoUrl }: LeadershipCardProps) {
  return (
    <article className="ch-card ch-leadership-card">
      <div className="ch-card-media ch-leadership-card-media">
        <img
          src={photoUrl || "/images/leader-placeholder.jpg"}
          alt={name}
          loading="lazy"
        />
      </div>
      <div className="ch-card-body ch-leadership-card-body">
        <h3 className="ch-leadership-card-name">{name}</h3>
        <div className="ch-leadership-card-role">{role}</div>
        {bio && (
          <p className="ch-leadership-card-bio">{bio}</p>
        )}
      </div>
    </article>
  );
}
