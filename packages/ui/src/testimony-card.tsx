export interface TestimonyCardProps {
  id: string;
  author: string;
  location?: string;
  testimony: string;
  category?: string;
}

export function TestimonyCard({ author, location, testimony, category }: TestimonyCardProps) {
  return (
    <article className="ch-card">
      <div className="ch-card-body">
        {category && (
          <span
            className="ch-eyebrow"
            style={{ fontSize: "11px", marginBottom: "8px" }}
          >
            {category}
          </span>
        )}
        <div style={{ fontSize: "28px", color: "var(--church-accent)", lineHeight: 1 }}>
          “
        </div>
        <p
          style={{
            fontSize: "15px",
            lineHeight: 1.6,
            color: "var(--church-text)",
            fontStyle: "italic",
            margin: "0 0 16px 0",
            flexGrow: 1,
          }}
        >
          {testimony}
        </p>
        <div style={{ borderTop: "1px solid var(--church-border)", paddingTop: "12px" }}>
          <strong
            style={{
              display: "block",
              fontSize: "14px",
              color: "var(--church-primary)",
            }}
          >
            {author}
          </strong>
          {location && (
            <small style={{ color: "var(--church-text-muted)", fontSize: "12px" }}>
              📍 {location}
            </small>
          )}
        </div>
      </div>
    </article>
  );
}
