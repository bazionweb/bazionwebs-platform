"use client";

import { ResponsiveImage } from "./responsive-image.js";

export interface SermonCardProps {
  id: string;
  title: string;
  speaker: string;
  date: string;
  scriptureReference?: string;
  category?: string;
  thumbnailUrl?: string;
  youtubeVideoId?: string;
  slug?: string;
  onWatch?: (sermon: { id: string; title: string; youtubeVideoId?: string }) => void;
}

export function SermonCard({
  id,
  title,
  speaker,
  date,
  scriptureReference,
  category,
  thumbnailUrl,
  youtubeVideoId,
  slug,
  onWatch,
}: SermonCardProps) {
  const thumbnail =
    thumbnailUrl ||
    (youtubeVideoId
      ? `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`
      : "/images/sermon-placeholder.jpg");

  const detailUrl = slug ? `/sermons/${slug}` : undefined;

  return (
    <article className="ch-card">
      <div className="ch-card-media">
        <ResponsiveImage src={thumbnail} alt={title} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 33vw" />
        {youtubeVideoId && (
          <button
            type="button"
            className="ch-btn ch-btn-accent"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              width: "52px",
              height: "52px",
              padding: 0,
            }}
            aria-label={`Watch sermon: ${title}`}
            onClick={() => onWatch?.({ id, title, youtubeVideoId })}
          >
            ▶
          </button>
        )}
      </div>
      <div className="ch-card-body">
        {category && <span className="ch-sermon-badge">{category}</span>}
        <h3 className="ch-sermon-title">
          {detailUrl ? (
            <a href={detailUrl} style={{ color: "inherit", textDecoration: "none" }}>
              {title}
            </a>
          ) : (
            title
          )}
        </h3>
        <div className="ch-sermon-meta">
          <span>By {speaker}</span>
          <span>•</span>
          <span>{date}</span>
        </div>
        {scriptureReference && (
          <div className="ch-sermon-scripture">📖 {scriptureReference}</div>
        )}
        <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
          {youtubeVideoId && (
            <button
              type="button"
              className="ch-btn ch-btn-primary"
              style={{ flexGrow: 1 }}
              onClick={() => onWatch?.({ id, title, youtubeVideoId })}
            >
              Watch Video
            </button>
          )}
          {detailUrl && (
            <a href={detailUrl} className="ch-btn ch-btn-outline" style={{ flexGrow: 1 }}>
              Sermon Notes
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
