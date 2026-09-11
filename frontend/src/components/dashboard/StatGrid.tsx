import type { StatCardData } from "../../lib/mockData";

export function StatGrid({ stats }: { stats: StatCardData[] }) {
  return (
    <div className="stat-grid">
      {stats.map((stat) => (
        <div className="stat-card" key={stat.label}>
          <div className="stat-label">{stat.label}</div>
          <div className={`stat-value${stat.tone ? ` ${stat.tone}` : ""}`}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}
