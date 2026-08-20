import { useEffect, useState } from "react";
import api from "../api";
import Banner from "../components/Banner";
import IssueList from "../components/IssueList";

export default function Security() {
  const [issues, setIssues] = useState(null);
  const [notConfigured, setNotConfigured] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, notConfigured } = await api.listIssues({ category: "security-sensitive" });
      setIssues(data?.issues || []);
      setNotConfigured(notConfigured);
    })();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Security-Sensitive Issues</div>
          <div className="page-sub">Flagged by keyword scan regardless of other signals — review first.</div>
        </div>
      </div>
      <Banner notConfigured={notConfigured} />
      {issues === null ? <div className="loader">Loading…</div> : <IssueList issues={issues} />}
    </div>
  );
}
