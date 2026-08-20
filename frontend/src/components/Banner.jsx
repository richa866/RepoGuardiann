export default function Banner({ notConfigured }) {
  if (!notConfigured) return null;
  return (
    <div
      style={{
        background: "color-mix(in srgb, var(--amber) 14%, var(--bg-elevated))",
        border: "1px solid color-mix(in srgb, var(--amber) 45%, transparent)",
        color: "var(--text)",
        padding: "10px 16px",
        borderRadius: 10,
        margin: "0 0 16px 0",
        fontSize: 13,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 16 }}>⚠️</span>
      <div>
        <strong>Not configured:</strong> {notConfigured.message}{" "}
        <span style={{ color: "var(--text-dim)" }}>
          (missing {notConfigured.missing?.join(", ")}) — add these to backend/.env and restart.
        </span>
      </div>
    </div>
  );
}
