import { Link } from "react-router-dom";

// Human-readable renderers per tool, keyed to the exact evidence shape each
// backend tool function returns (app/tools.py). Falls back to a generic
// key/value list for any tool that doesn't have a custom renderer, so a new
// tool added later still displays something readable without frontend changes.

function Row({ label, children }) {
  return (
    <div className="ev-row">
      <span className="ev-label">{label}</span>
      <span className="ev-value">{children}</span>
    </div>
  );
}

function Bool({ value }) {
  return <span className={value ? "ev-yes" : "ev-no"}>{value ? "Yes" : "No"}</span>;
}

function DuplicateCheck({ data }) {
  return (
    <>
      <Row label="Best match">
        {data.best_match ? (
          <>
            <Link to={`/issues/${data.best_match.number}`}>#{data.best_match.number}</Link>{" "}
            &ldquo;{data.best_match.title}&rdquo; — <strong>{(data.best_match.similarity * 100).toFixed(1)}%</strong> similar
            {" "}({data.best_match.state})
          </>
        ) : "no similar issues found"}
      </Row>
      <Row label="Likely duplicate?"><Bool value={data.is_likely_duplicate} /> (threshold ≥{(data.threshold_duplicate * 100).toFixed(0)}%)</Row>
      <Row label="Possible regression?"><Bool value={data.is_possible_regression} /> (threshold ≥{(data.threshold_regression * 100).toFixed(0)}%, closed issue)</Row>
      {data.best_match?.resolution && <Row label="Maintainer resolution">{data.best_match.resolution}</Row>}
    </>
  );
}

function ResponseTimeCheck({ data }) {
  return (
    <>
      <Row label="Days without response">{data.days_without_response}</Row>
      <Row label="Comments so far">{data.comment_count}</Row>
      <Row label="Similar open reports">
        {data.similar_open_report_numbers.length
          ? data.similar_open_report_numbers.map((n) => <Link key={n} to={`/issues/${n}`} style={{ marginRight: 6 }}>#{n}</Link>)
          : "none"}
      </Row>
      <Row label="Flagged urgent?"><Bool value={data.is_urgent_no_response} /> (threshold ≥{data.threshold_days} days + a similar open report)</Row>
    </>
  );
}

function SecurityKeywordCheck({ data }) {
  return (
    <>
      <Row label="Security-sensitive?"><Bool value={data.is_security_sensitive} /></Row>
      {data.hits.length > 0 && (
        <Row label="Matched keywords">
          <ul className="ev-list">
            {data.hits.map((h, i) => (
              <li key={i}><strong>{h.keyword}</strong> in {h.field} — &ldquo;{h.snippet}&rdquo;</li>
            ))}
          </ul>
        </Row>
      )}
    </>
  );
}

function StalenessCheck({ data }) {
  return (
    <>
      <Row label="Age">{data.age_days} days</Row>
      <Row label="Labels / comments">{data.label_count} labels, {data.comment_count} comments</Row>
      <Row label="Stale / needs triage?"><Bool value={data.is_stale_needs_triage} /> (threshold ≥{data.threshold_days} days, 0 labels, 0 comments)</Row>
    </>
  );
}

function MissingInfoCheck({ data }) {
  return (
    <>
      <Row label="Looks like a bug report?"><Bool value={data.looks_like_bug_report} /></Row>
      <Row label="Has reproduction steps?"><Bool value={data.has_repro_steps} /></Row>
      <Row label="Has environment/version info?"><Bool value={data.has_env_info} /></Row>
      <Row label="Needs more info?"><Bool value={data.needs_more_info} /></Row>
    </>
  );
}

function ContentiousnessCheck({ data }) {
  return (
    <>
      <Row label="Discussion size">{data.comment_count} comments, {data.distinct_participants} distinct participants</Row>
      <Row label="Contentious?"><Bool value={data.is_contentious} /> (threshold ≥{data.threshold_participants} participants &amp; ≥{data.threshold_comments} comments, or pushback language)</Row>
      {data.pushback_hits?.length > 0 && (
        <Row label="Pushback language">
          <ul className="ev-list">
            {data.pushback_hits.map((h, i) => (
              <li key={i}><strong>{h.keyword}</strong> from {h.author} — &ldquo;{h.snippet}&rdquo;</li>
            ))}
          </ul>
        </Row>
      )}
    </>
  );
}

const RENDERERS = {
  duplicate_check: DuplicateCheck,
  response_time_check: ResponseTimeCheck,
  security_keyword_check: SecurityKeywordCheck,
  staleness_check: StalenessCheck,
  missing_info_check: MissingInfoCheck,
  contentiousness_check: ContentiousnessCheck,
};

const TOOL_TITLES = {
  duplicate_check: "Duplicate & Regression Check",
  response_time_check: "Response Time Check",
  security_keyword_check: "Security Keyword Scan",
  staleness_check: "Staleness Check",
  missing_info_check: "Missing Info Check",
  contentiousness_check: "Contentiousness Check",
};

function GenericFallback({ data }) {
  const { tool, ...rest } = data;
  return (
    <ul className="ev-list">
      {Object.entries(rest).map(([k, v]) => (
        <li key={k}>
          <strong>{k}</strong>: {typeof v === "object" ? JSON.stringify(v) : String(v)}
        </li>
      ))}
    </ul>
  );
}

export default function EvidenceCard({ toolKey, data }) {
  if (!data || data.error) return null;
  const Renderer = RENDERERS[toolKey] || GenericFallback;
  return (
    <div className="evidence-block">
      <h4>{TOOL_TITLES[toolKey] || toolKey}</h4>
      <Renderer data={data} />
    </div>
  );
}
