export const CATEGORY_META = {
  urgent: {
    label: "Urgent",
    color: "var(--cat-urgent)",
    icon: "⏱",
    why: "No maintainer response in 5+ days, and other people are reporting the same thing.",
  },
  "security-sensitive": {
    label: "Security",
    color: "var(--cat-security)",
    icon: "🛡",
    why: "Mentions a security/vulnerability keyword — reviewed first regardless of anything else.",
  },
  "possible-regression": {
    label: "Regression",
    color: "var(--cat-regression)",
    icon: "↩",
    why: "Very similar to an issue that was already closed — may be back.",
  },
  "likely-duplicate": {
    label: "Duplicate",
    color: "var(--cat-duplicate)",
    icon: "⧉",
    why: "Very similar to another issue already on file (embedding similarity search).",
  },
  "stale/needs-triage": {
    label: "Stale",
    color: "var(--cat-stale)",
    icon: "🕸",
    why: "Open 30+ days with no labels and no comments — nobody has looked at this yet.",
  },
  "needs-more-info": {
    label: "Needs Info",
    color: "var(--cat-info)",
    icon: "❓",
    why: "Looks like a bug report missing reproduction steps or environment/version details.",
  },
  contentious: {
    label: "Contentious",
    color: "var(--cat-contentious)",
    icon: "⚡",
    why: "Active disagreement in the comments — several participants or explicit pushback language.",
  },
};

export default function CategoryBadge({ category, showIcon = true }) {
  const meta = CATEGORY_META[category] || { label: category, color: "var(--text-dim)", icon: "•", why: "" };
  return (
    <span
      title={meta.why}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 600,
        letterSpacing: 0.2,
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${meta.color} 40%, transparent)`,
        whiteSpace: "nowrap",
        cursor: meta.why ? "help" : "default",
      }}
    >
      {showIcon && <span aria-hidden="true">{meta.icon}</span>}
      {meta.label}
    </span>
  );
}
