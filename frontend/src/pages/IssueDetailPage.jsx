import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import Banner from "../components/Banner";
import CategoryBadge from "../components/CategoryBadge";
import EvidenceCard from "../components/EvidenceCard";

const TOOL_KEYS = [
  "security_keyword_check",
  "duplicate_check",
  "response_time_check",
  "contentiousness_check",
  "staleness_check",
  "missing_info_check",
];

export default function IssueDetailPage() {
  const { number } = useParams();
  const [detail, setDetail] = useState(null);
  const [notConfigured, setNotConfigured] = useState(null);
  const [error, setError] = useState(null);
  const [feedbackSent, setFeedbackSent] = useState(null);

  async function load() {
    const { data, notConfigured, error } = await api.getIssue(number);
    setDetail(data);
    setNotConfigured(notConfigured);
    setError(error);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [number]);

  async function vote(v) {
    const latestEscalation = detail?.escalations?.[0];
    await api.submitFeedback(number, {
      vote: v,
      escalation_id: latestEscalation?.id ?? null,
    });
    setFeedbackSent(v);
    load();
  }

  if (error) return <div className="empty-state">Error: {error}</div>;
  if (notConfigured) return <><Banner notConfigured={notConfigured} /></>;
  if (!detail) return <div className="loader">Loading…</div>;

  const { issue, comments, escalations, similar_issues, subtasks, feedback } = detail;
  const latest = escalations[0];

  return (
    <div>
      <Link to="/" className="back-link">&larr; Back to all issues</Link>
      <div className="page-header">
        <div>
          <div className="page-title">
            #{issue.number} {issue.title}
          </div>
          <div className="page-sub">
            <span className={"state-dot state-" + issue.state} style={{ display: "inline-block", marginRight: 6 }} />
            {issue.state} · {issue.comments_count} comments · opened {new Date(issue.created_at).toLocaleDateString()}
            {issue.url && <> · <a href={issue.url} target="_blank" rel="noreferrer">view on GitHub</a></>}
          </div>
        </div>
        <div className="issue-cats">
          {(latest?.categories || []).map((c) => <CategoryBadge key={c} category={c} />)}
        </div>
      </div>

      {latest && (
        <div className="explanation-box">
          <strong>{latest.escalate ? "Escalated" : "Not escalated"}</strong> — {latest.explanation}
          {latest.human_override && (
            <div style={{ marginTop: 6, color: "var(--text-dim)", fontSize: 12 }}>
              Human feedback: <strong>{latest.human_override}</strong>
            </div>
          )}
        </div>
      )}

      <div className="grid-2">
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Issue Body</div>
            <p style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--text-dim)" }}>
              {issue.body || "(no description)"}
            </p>
          </div>

          {latest && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">
                Evidence Trail — {TOOL_KEYS.filter((k) => latest.evidence?.[k] && !latest.evidence[k].error).length} agent tool calls
              </div>
              <p className="section-sub">
                Every category above is backed by one or more of these checks. Hover a badge to see why it fired.
              </p>
              {TOOL_KEYS.map((key) => (
                <EvidenceCard key={key} toolKey={key} data={latest.evidence?.[key]} />
              ))}
            </div>
          )}

          {latest?.drafted_comment && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="section-title">Drafted Follow-up Comment (not sent — human approval required)</div>
              <p style={{ fontSize: 13, color: "var(--text)" }}>{latest.drafted_comment}</p>
            </div>
          )}

          <div className="card">
            <div className="section-title">Comments ({comments.length})</div>
            {comments.length === 0 && <p style={{ color: "var(--text-faint)", fontSize: 13 }}>No comments.</p>}
            {comments.map((c) => (
              <div key={c.id} style={{ marginBottom: 10, fontSize: 13 }}>
                <strong>{c.author}</strong>{" "}
                <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                  {new Date(c.created_at).toLocaleString()}
                </span>
                <div style={{ color: "var(--text-dim)" }}>{c.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Similar Issues (RAG)</div>
            {(!similar_issues || similar_issues.length === 0) && (
              <p style={{ color: "var(--text-faint)", fontSize: 12.5 }}>No similar issues found.</p>
            )}
            {similar_issues?.map((s) => (
              <div key={s.number} className="similar-item">
                <div>
                  <Link to={`/issues/${s.number}`}>#{s.number}</Link> {s.title}
                  {s.resolution && (
                    <div style={{ color: "var(--text-faint)", fontSize: 11 }}>{s.resolution}</div>
                  )}
                </div>
                <span className="similarity-score">{(s.similarity * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="section-title">Subtask History</div>
            {subtasks.length === 0 && <p style={{ color: "var(--text-faint)", fontSize: 12.5 }}>No subtasks yet.</p>}
            {subtasks.map((s) => (
              <div key={s.id} className={"subtask-log-item " + s.status}>
                <strong>{s.task_type}</strong> — {s.status}
                <div style={{ color: "var(--text-faint)", fontSize: 11 }}>
                  {s.created_at && new Date(s.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="section-title">Human Feedback</div>
            <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
              Confirm or override this AI decision. Your feedback is recorded against escalation #{latest?.id ?? "n/a"}.
            </p>
            <div className="feedback-btns">
              <button className="btn" onClick={() => vote("up")}>👍 Confirm</button>
              <button className="btn" onClick={() => vote("down")}>👎 Dismiss</button>
            </div>
            {feedbackSent && (
              <p style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>Feedback recorded: {feedbackSent}</p>
            )}
            {feedback.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {feedback.map((f) => (
                  <div key={f.id} style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
                    {f.vote === "up" ? "👍" : "👎"} {new Date(f.created_at).toLocaleString()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
