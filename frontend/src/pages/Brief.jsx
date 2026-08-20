import { useEffect, useState } from "react";
import api from "../api";
import Banner from "../components/Banner";

export default function Brief() {
  const [brief, setBrief] = useState(null);
  const [notConfigured, setNotConfigured] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, notConfigured } = await api.brief();
      setBrief(data);
      setNotConfigured(notConfigured);
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Maintainer Weekly Brief</div>
          <div className="page-sub">Auto-generated summary of repo health and escalated issues.</div>
        </div>
      </div>
      <Banner notConfigured={notConfigured} />
      {loading && <div className="loader">Generating brief…</div>}
      {!loading && brief && (
        <div className="explanation-box" style={{ fontSize: 14.5 }}>
          {brief.brief}
          <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--text-faint)" }}>
            Generated via {brief.method === "gemini" ? "Gemini synthesis" : "rule-based template (Gemini not configured)"}
          </div>
        </div>
      )}
    </div>
  );
}
