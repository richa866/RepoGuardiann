import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({ baseURL: BASE_URL, timeout: 30000 });

// Every call returns { data, notConfigured, error } instead of throwing, so
// components can render a clear banner instead of a blank screen when
// GitHub/Gemini keys are missing (503 not_configured) or the backend is down.
async function call(promise) {
  try {
    const res = await promise;
    return { data: res.data, notConfigured: null, error: null };
  } catch (err) {
    if (err.response?.status === 503 && err.response?.data?.error === "not_configured") {
      return { data: null, notConfigured: err.response.data, error: null };
    }
    return { data: null, notConfigured: null, error: err.response?.data?.message || err.message };
  }
}

// /connect surfaces a distinct, structured error per failure case (not_found,
// token_invalid, private_no_token, rate_limited, sync_in_progress) -- callers
// render exc.code/exc.message directly instead of a generic toast.
async function callConnect(promise) {
  try {
    const res = await promise;
    return { data: res.data, error: null };
  } catch (err) {
    // FastAPI's HTTPException(status, {"error": code, "message": msg}) serializes
    // as {"detail": {"error": code, "message": msg}} -- note the key is "error", not "code".
    const detail = err.response?.data?.detail;
    if (detail?.error) {
      return { data: null, error: { code: detail.error, message: detail.message, status: err.response.status } };
    }
    return { data: null, error: { code: "unknown", message: err.message, status: err.response?.status } };
  }
}

export const api = {
  health: () => call(client.get("/health")),
  connect: (repo, token) => callConnect(client.post("/connect", { repo, token: token || null })),
  syncStatus: (repo) => call(client.get("/sync/status", { params: repo ? { repo } : {} })),
  listRepos: () => call(client.get("/repos")),
  switchRepo: (repo) => call(client.post("/repos/active", { repo })),
  sync: (repo) => call(client.post("/sync", null, { params: repo ? { repo } : {} })),
  listIssues: (params = {}) => call(client.get("/issues", { params })),
  getIssue: (number, repo) => call(client.get(`/issues/${number}`, { params: repo ? { repo } : {} })),
  submitFeedback: (number, body) => call(client.post(`/issues/${number}/feedback`, body)),
  healthMetrics: (repo) => call(client.get("/health-metrics", { params: repo ? { repo } : {} })),
  healthTrendsSummary: (repo) => call(client.get("/api/health-trends/summary", { params: repo ? { repo } : {} })),
  healthTrendsBacklogDrift: (repo, days = 30) => call(client.get("/api/health-trends/backlog-drift", { params: { ...(repo ? { repo } : {}), ...(days ? { days } : {}) } })),
  healthTrendsCategoryBreakdown: (repo) => call(client.get("/api/health-trends/category-breakdown", { params: repo ? { repo } : {} })),
  overrideStats: (repo) => call(client.get("/feedback/override-stats", { params: repo ? { repo } : {} })),
  monitorStatus: (repo) => call(client.get("/monitor/status", { params: repo ? { repo } : {} })),
  checkNow: (repo) => call(client.post("/monitor/check-now", null, { params: repo ? { repo } : {} })),
  brief: (repo) => call(client.get("/brief", { params: repo ? { repo } : {} })),
  postComment: (number, body, repo) => call(client.post(`/issues/${number}/comment`, { body, repo })),
  addLabels: (number, labels, repo) => call(client.post(`/issues/${number}/labels`, { labels, repo })),
  closeIssue: (number, reason, comment, repo) => call(client.post(`/issues/${number}/close`, { reason, comment, repo })),
};

export default api;
