import { Link } from "react-router-dom";
import CategoryBadge from "./CategoryBadge";

export default function IssueList({ issues }) {
  if (!issues || issues.length === 0) {
    return <div className="empty-state">No issues to show yet. Run a sync or seed dummy data.</div>;
  }
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <Link key={issue.number} to={`/issues/${issue.number}`} className="issue-row">
          <span className={"state-dot state-" + issue.state} title={issue.state} />
          <span className="issue-number">#{issue.number}</span>
          <span className="issue-title">{issue.title}</span>
          <span className="issue-meta">{issue.comments_count} comments</span>
          <span className="issue-meta">{new Date(issue.updated_at).toLocaleDateString()}</span>
          <span className="issue-cats">
            {(issue.latest_categories || []).map((c) => (
              <CategoryBadge key={c} category={c} />
            ))}
          </span>
        </Link>
      ))}
    </div>
  );
}
