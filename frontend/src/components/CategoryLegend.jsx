import { CATEGORY_META } from "./CategoryBadge";

export default function CategoryLegend() {
  return (
    <div className="legend">
      {Object.entries(CATEGORY_META).map(([key, meta]) => (
        <span key={key} className="legend-item" title={meta.why}>
          <span className="legend-dot" style={{ background: meta.color }} />
          {meta.label}
        </span>
      ))}
    </div>
  );
}
