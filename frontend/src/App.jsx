import React, { useState, useEffect, useCallback } from 'react';
import api from './api';
import { Dynamic3DLoginPage } from './components/auth/Dynamic3DLoginPage';
import { SpaceLoadingScreen } from './components/intro/SpaceLoadingScreen';
import { GitBranchGraph3D } from './components/3d/GitBranchGraph3D';
import { GitTreeScene } from './components/3d/GitTreeScene';
import { TopNav } from './components/hud/TopNav';
import { MonitorPanel } from './components/hud/MonitorPanel';
import { IssueDetailPanel } from './components/hud/IssueDetailPanel';
import { ListView2D } from './components/hud/ListView2D';
import { PullRequestsView } from './components/hud/PullRequestsView';
import { HealthMetricsView } from './components/hud/HealthMetricsView';
import { WeeklyBriefView } from './components/hud/WeeklyBriefView';
import { ConnectRepoModal } from './components/hud/ConnectRepoModal';
import { KeyboardShortcutsModal } from './components/hud/KeyboardShortcutsModal';
import { Sparkles, Keyboard } from 'lucide-react';
import './App.css';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('repoguardian_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('repoguardian_token'));

  // App lifecycle stages: 'login' -> 'loading' (Black Hole) -> 'branch_viz' -> 'main'
  const [appStage, setAppStage] = useState(() => {
    // If no authenticated session, start at 3D login page
    return localStorage.getItem('repoguardian_token') ? 'loading' : 'login';
  });
  const [isWarpTransitioning, setIsWarpTransitioning] = useState(false);

  const [health, setHealth] = useState(null);
  const [repos, setRepos] = useState([]);
  const [issues, setIssues] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeView, setActiveView] = useState('3d');
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Load health, issues, and monitor loop status
  // GET /issues is paginated (backend caps a single page at limit<=1000), and
  // the true item count grows as a repo syncs -- a fixed limit=500 silently
  // truncated to whatever GitHub's most-recently-updated 500 items were,
  // which on an active repo skews toward PRs and undercounts real, older,
  // still-open issues. Page through with offset until `total` is covered
  // instead, so every count on screen (topbar, Filter Matrix, 3D
  // constellation) reflects the backend's actual totals, not a stale slice.
  const PAGE_SIZE = 500;

  const fetchAllIssues = useCallback(async (repo) => {
    const first = await api.listIssues({ repo, limit: PAGE_SIZE, offset: 0 });
    const total = first?.data?.total ?? 0;
    let all = first?.data?.issues ?? [];

    const remainingRequests = [];
    for (let offset = all.length; offset < total; offset += PAGE_SIZE) {
      remainingRequests.push(api.listIssues({ repo, limit: PAGE_SIZE, offset }));
    }
    if (remainingRequests.length) {
      const pages = await Promise.all(remainingRequests);
      all = all.concat(...pages.map((p) => p?.data?.issues ?? []));
    }
    return all;
  }, []);

  const refreshData = useCallback(async (targetRepo) => {
    const [{ data: h }, { data: repoRes }] = await Promise.all([
      api.health(targetRepo),
      api.listRepos(),
    ]);
    if (repoRes?.repos) {
      setRepos(repoRes.repos);
    }
    if (h) {
      setHealth(h);
      const active = targetRepo || h.active_repo;
      if (active) {
        const [allIssues, { data: monRes }] = await Promise.all([
          fetchAllIssues(active),
          api.monitorStatus(active),
        ]);
        if (allIssues) {
          setIssues(allIssues);
          // Build feedbackMap fresh from server on every refresh -- no stale
          // local accumulation, undo/reset are always reflected (the old
          // accumulate-and-guard-with-!next[i.number] approach meant a
          // server-side reset of an override would never clear client-side).
          const fresh = {};
          allIssues.forEach((i) => {
            if (i.latest_feedback) {
              fresh[i.number] = i.latest_feedback;
            } else if (i.latest_human_override) {
              fresh[i.number] = i.latest_human_override === 'confirmed' ? 'up' : 'down';
            }
          });
          setFeedbackMap(fresh);
        }
        if (monRes) setMonitorStatus(monRes);
      }
    }
  }, [fetchAllIssues]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(() => refreshData(), 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Transition from Branch Topology to Main Triage Page
  const handleEngageTriage = () => {
    setIsWarpTransitioning(true);
    setTimeout(() => {
      setAppStage('main');
      setActiveView('3d');
      setIsWarpTransitioning(false);
      showToast('Agentic Triage Engaged: 3D escalation matrix loaded');
    }, 600);
  };

  // Sync trigger
  const handleSync = async () => {
    if (!health?.active_repo) return;
    setIsSyncing(true);
    const { data, error, notConfigured } = await api.sync(health.active_repo);
    setIsSyncing(false);
    if (notConfigured) {
      showToast(`Sync warning: missing ${notConfigured.missing.join(', ')}`);
    } else if (error) {
      showToast(`Sync failed: ${error}`);
    } else {
      showToast(`Sync complete! Fetched ${data.fetched} issues, ${data.changed} changed.`);
      refreshData();
    }
  };

  // Check now trigger (agent loop)
  const handleCheckNow = async () => {
    if (!health?.active_repo) return;
    setIsChecking(true);
    const { data, error } = await api.checkNow(health.active_repo);
    setIsChecking(false);
    if (!error) {
      showToast(`Agent loop executed! Processed subtask queue.`);
      refreshData();
    }
  };

  const handleFeedbackSubmitted = (issueNum, vote) => {
    if (vote === null) {
      // Undo: remove from feedbackMap entirely
      setFeedbackMap((prev) => {
        const next = { ...prev };
        delete next[issueNum];
        return next;
      });
      showToast(`Feedback reset for #${issueNum} — restored to AI triage state`);
    } else {
      setFeedbackMap((prev) => ({ ...prev, [issueNum]: vote }));
      if (vote === 'down' && selectedIssue?.number === issueNum) {
        setSelectedIssue(null);
      }
      showToast(`Feedback recorded for #${issueNum} (${vote === 'up' ? 'Confirmed' : 'Overridden'})`);
    }
    refreshData();
  };

  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Global Maintainer Keyboard Shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) {
        if (e.key === 'Escape') e.target.blur();
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isShortcutsOpen) setIsShortcutsOpen(false);
        else if (isConnectOpen) setIsConnectOpen(false);
        else if (selectedIssue) setSelectedIssue(null);
      } else if (e.key === '1') {
        setActiveView('3d');
      } else if (e.key === '2') {
        setActiveView('list');
      } else if (e.key === '3') {
        setActiveView('health');
      } else if (e.key === '4') {
        setActiveView('brief');
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        if (issues.length > 0) {
          const currentIdx = selectedIssue ? issues.findIndex((i) => i.number === selectedIssue.number) : -1;
          const nextIdx = currentIdx < issues.length - 1 ? currentIdx + 1 : 0;
          setSelectedIssue(issues[nextIdx]);
        }
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        if (issues.length > 0) {
          const currentIdx = selectedIssue ? issues.findIndex((i) => i.number === selectedIssue.number) : 0;
          const prevIdx = currentIdx > 0 ? currentIdx - 1 : issues.length - 1;
          setSelectedIssue(issues[prevIdx]);
        }
      } else if (e.key.toLowerCase() === 'u' && selectedIssue) {
        handleFeedbackSubmitted(selectedIssue.number, 'up');
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
        refreshData();
        showToast('Refreshing repository telemetry...');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [issues, selectedIssue, isShortcutsOpen, isConnectOpen, refreshData]);

  const handleRepoConnected = (newRepo) => {
    showToast(`Connected to ${newRepo}!`);
    setSelectedIssue(null);
    refreshData();
    setAppStage('branch_viz');
  };

  const handleSwitchRepo = async (newRepo) => {
    setSelectedIssue(null);
    showToast(`Switching to ${newRepo}...`);
    await api.switchRepo(newRepo);
    await refreshData(newRepo);
    showToast(`Switched active repository to ${newRepo}`);
  };

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    setSessionToken(token);
    setAppStage('loading');
    refreshData();
    showToast(`Welcome to RepoGuardian Matrix, @${user?.login || 'maintainer'}!`);
  };

  const handleLogout = async () => {
    if (sessionToken) {
      await api.authLogout(sessionToken);
    }
    localStorage.removeItem('repoguardian_token');
    localStorage.removeItem('repoguardian_user');
    setCurrentUser(null);
    setSessionToken(null);
    setSelectedIssue(null);
    setAppStage('login');
    showToast('Signed out of RepoGuardian.');
  };

  const escalatedCount = issues.filter((i) => i.latest_escalate).length;
  const openIssuesCount = issues.filter((i) => (i.state === 'open' || !i.state) && !i.is_pr).length;
  const openPrsCount = issues.filter((i) => i.state === 'open' && i.is_pr).length;

  // 1. Dynamic 3D Login Page
  if (appStage === 'login') {
    return (
      <Dynamic3DLoginPage
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  // 2. Black Hole Singularity Loading Screen (Appears immediately after login)
  if (appStage === 'loading') {
    return (
      <SpaceLoadingScreen
        activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
        onFinish={() => setAppStage('branch_viz')}
      />
    );
  }

  // 3. 3D Git Branch Graph Visualization (Initial Landing after Loading)
  if (appStage === 'branch_viz') {
    return (
      <div className="relative w-full max-w-full h-screen overflow-hidden bg-[#06090f]">
        <GitBranchGraph3D
          key={`branch-viz-${health?.active_repo || 'default'}`}
          activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
          issues={issues}
          onShowIssues={handleEngageTriage}
        />

        {/* Transition Shockwave Effect */}
        {isWarpTransitioning && (
          <div className="fixed inset-0 z-50 bg-red-600/40 backdrop-blur-2xl animate-ping pointer-events-none flex items-center justify-center">
            <div className="text-white font-mono text-xl font-bold uppercase tracking-widest bg-red-950/90 px-6 py-3 rounded-2xl border border-red-500 shadow-2xl">
              ENGAGING REPO GUARDIAN TRIAGE MATRIX...
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Main RepoGuardian App (The Full Categorized 3D Triage Tree + HUD)
  return (
    <div className="relative w-full max-w-full h-screen overflow-hidden bg-[#06090f] text-slate-100 font-sans select-none">
      {/* Red Shockwave Transition Out */}
      {isWarpTransitioning && (
        <div className="fixed inset-0 z-50 bg-red-600/30 backdrop-blur-xl animate-fade-out pointer-events-none" />
      )}

      {/* Sleek Header Navigation */}
      <TopNav
        health={health}
        repos={repos}
        onSwitchRepo={handleSwitchRepo}
        activeView={activeView}
        onSelectView={setActiveView}
        onSync={handleSync}
        isSyncing={isSyncing}
        onCheckNow={handleCheckNow}
        isChecking={isChecking}
        onOpenConnect={() => setIsConnectOpen(true)}
        issuesCount={issues.length}
        openIssuesCount={openIssuesCount}
        openPrsCount={openPrsCount}
        escalatedCount={escalatedCount}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main View Area */}
      <main className="w-full h-full relative">
        {activeView === 'topology' && (
          <GitBranchGraph3D
            key={`topology-${health?.active_repo || 'default'}`}
            activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
            issues={issues}
            onShowIssues={() => setActiveView('3d')}
          />
        )}

        {activeView === '3d' && (
          <div className="w-full h-full">
            <GitTreeScene
              key={`tree-${health?.active_repo || 'default'}`}
              activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
              issues={issues}
              selectedIssue={selectedIssue}
              onSelectIssue={setSelectedIssue}
              feedbackMap={feedbackMap}
              onFeedbackSubmitted={handleFeedbackSubmitted}
              fallback={
                <ListView2D
                  key={`list-fallback-${health?.active_repo || 'default'}`}
                  issues={issues}
                  selectedIssue={selectedIssue}
                  onSelectIssue={setSelectedIssue}
                  feedbackMap={feedbackMap}
                />
              }
            />
            {/* Top-Left Telemetry Micro-Pill & Collapsible Sheet */}
            <MonitorPanel
              monitorStatus={monitorStatus}
              onTriggerCheck={handleCheckNow}
              isChecking={isChecking}
            />
          </div>
        )}

        {activeView === 'prs' && (
          <PullRequestsView
            key={`prs-${health?.active_repo || 'default'}`}
            issues={issues}
            selectedIssue={selectedIssue}
            onSelectIssue={setSelectedIssue}
            feedbackMap={feedbackMap}
          />
        )}

        {activeView === 'list' && (
          <ListView2D
            key={`list-${health?.active_repo || 'default'}`}
            issues={issues}
            selectedIssue={selectedIssue}
            onSelectIssue={setSelectedIssue}
            feedbackMap={feedbackMap}
          />
        )}

        {activeView === 'health' && (
          <HealthMetricsView
            key={`health-${health?.active_repo || 'default'}`}
            repo={health?.active_repo}
          />
        )}

        {activeView === 'brief' && (
          <WeeklyBriefView
            key={`brief-${health?.active_repo || 'default'}`}
            repo={health?.active_repo}
          />
        )}
      </main>

      {/* Right-Side Streamlined Issue Detail Panel */}
      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onFeedbackSubmitted={handleFeedbackSubmitted}
          feedbackMap={feedbackMap}
        />
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 border border-sky-500/40 text-xs font-mono text-sky-200 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200 backdrop-blur-xl">
          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Keyboard Shortcuts Trigger Button */}
      <button
        type="button"
        onClick={() => setIsShortcutsOpen(true)}
        className="fixed bottom-4 left-4 z-40 hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/80 border border-white/10 hover:border-sky-500/40 text-[11px] font-mono text-zinc-400 hover:text-sky-300 backdrop-blur-xl shadow-lg transition cursor-pointer"
        title="View Maintainer Keyboard Shortcuts (?)"
      >
        <Keyboard className="w-3 h-3 text-sky-400" />
        <span>Shortcuts</span>
        <kbd className="px-1 py-0.2 rounded bg-white/10 text-white font-bold text-[9px]">?</kbd>
      </button>

      {/* Connect Repo Modal */}
      <ConnectRepoModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onConnected={handleRepoConnected}
        user={currentUser}
        sessionToken={sessionToken}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />
    </div>
  );
}
