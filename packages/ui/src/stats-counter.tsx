export interface StatItem {
  label: string;
  value: number | string;
  suffix?: string;
  prefix?: string;
}

export interface StatsCounterProps {
  stats: StatItem[];
  title?: string;
  subtitle?: string;
}

export function StatsCounter({ stats, title, subtitle }: StatsCounterProps) {
  return (
    <section className="ch-section ch-section-alt">
      <div className="ch-container">
        {(title || subtitle) && (
          <div className="ch-heading-wrap">
            {title && <h2 className="ch-title">{title}</h2>}
            {subtitle && <p className="ch-subtitle">{subtitle}</p>}
          </div>
        )}
        <div className="ch-stats-grid">
          {stats.map((stat, idx) => (
            <div key={idx} className="ch-stat-item">
              <div className="ch-stat-val">
                {stat.prefix || ""}
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
                {stat.suffix || ""}
              </div>
              <div className="ch-stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
