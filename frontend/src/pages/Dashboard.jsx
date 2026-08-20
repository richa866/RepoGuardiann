import { useEffect, useState } from "react";
import api from "../api";
import Banner from "../components/Banner";
import IssueList from "../components/IssueList";
import CategoryLegend from "../components/CategoryLegend";

const CATEGORY_OPTIONS = [
  "", "urgent", "security-sensitive", "possible-regression",
  "likely-duplicate", "stale/needs-triage", "needs-more-info", "contentious",
];

export default function Dashboard() {
  const [issues, setIssues] = useState(null);
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("updated_at");
  const [notConfigured, setNotConfigured] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const params = {};
    if (state) params.state = state;
    if (category) params.category = category;
    if (sort) params.sort = sort;
    const { data, notConfigured, error } = await api.listIssues(params);
    setIssues(data?.issues || []);
    setNotConfigured(notConfigured);
    setError(error);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [state, category, sort]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Issue Feed</div>
          <div className="page-sub">
            {issues ? `${issues.length} issue${issues.length === 1 ? "" : "s"}` : "Loading…"}
          </div>
        </div>
      </div>
      <Banner notConfigured={notConfigured} />
      {error && <div className="empty-state">Error loading issues: {error}</div>}
      <CategoryLegend />
      <div className="filters">
        <select value={state} onChange={(e) => setState(e.target.value)}>
          <option value="">All states</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated_at">Sort: recently updated</option>
          <option value="created_at">Sort: recently created</option>
          <option value="comments_count">Sort: most comments</option>
          <option value="number">Sort: issue number</option>
        </select>
      </div>
      {issues === null ? <div className="loader">Loading issues…</div> : <IssueList issues={issues} />}
    </div>
  );
}
