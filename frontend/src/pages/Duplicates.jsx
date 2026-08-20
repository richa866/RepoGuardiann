import { useEffect, useState } from "react";
import api from "../api";
import Banner from "../components/Banner";
import IssueList from "../components/IssueList";

export default function Duplicates() {
  const [issues, setIssues] = useState(null);
  const [notConfigured, setNotConfigured] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, notConfigured } = await api.listIssues({ category: "likely-duplicate" });
      const dupOnly = data?.issues || [];
      const { data: regData } = await api.listIssues({ category: "possible-regression" });
      const merged = [...dupOnly];
      for (const i of regData?.issues || []) {
        if (!merged.find((m) => m.number === i.number)) merged.push(i);
      }
      setIssues(merged);
      setNotConfigured(notConfigured);
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Likely Duplicates &amp; Regressions</div>
          <div className="page-sub">Grouped view of issues flagged via embedding similarity search.</div>
        </div>
      </div>
      <Banner notConfigured={notConfigured} />
      {issues === null ? <div className="loader">Loading…</div> : <IssueList issues={issues} />}
    </div>
  );
}
