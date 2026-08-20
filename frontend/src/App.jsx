import React, { useState, useEffect, useCallback } from 'react';
import api from './api';
import { SpaceLoadingScreen } from './components/intro/SpaceLoadingScreen';
import { GitBranchGraph3D } from './components/3d/GitBranchGraph3D';
import { GitTreeScene } from './components/3d/GitTreeScene';
import { TopNav } from './components/hud/TopNav';
import { MonitorPanel } from './components/hud/MonitorPanel';
import { IssueDetailPanel } from './components/hud/IssueDetailPanel';
import { ListView2D } from './components/hud/ListView2D';
import { HealthMetricsView } from './components/hud/HealthMetricsView';
import { WeeklyBriefView } from './components/hud/WeeklyBriefView';
import { ConnectRepoModal } from './components/hud/ConnectRepoModal';
import { Layers, List, Activity, Sparkles, CheckCircle2, ShieldAlert, Zap } from 'lucide-react';
import './App.css';

export default function App() {
  // App lifecycle stages: 'loading' -> 'branch_viz' -> 'main'
  const [appStage, setAppStage] = useState('loading');
  const [isWarpTransitioning, setIsWarpTransitioning] = useState(false);

  const [health, setHealth] = useState(null);
  const [issues, setIssues] = useState([]);
  const [monitorStatus, setMonitorStatus] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [activeView, setActiveView] = useState('3d');
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Load health, issues, and monitor loop status
  const refreshData = useCallback(async () => {
    const { data: h } = await api.health();
    if (h) {
      setHealth(h);
      if (h.active_repo) {
        const [{ data: issueRes }, { data: monRes }] = await Promise.all([
          api.listIssues({ repo: h.active_repo, limit: 100 }),
          api.monitorStatus(h.active_repo),
        ]);
        if (issueRes?.issues) setIssues(issueRes.issues);
        if (monRes) setMonitorStatus(monRes);
      }
    }
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // Transition from Branch Topology to Main Triage Page
  const handleEngageTriage = () => {
    setIsWarpTransitioning(true);
    setTimeout(() => {
      setAppStage('main');
      setActiveView('3d');
      setIsWarpTransitioning(false);
      showToast('Agentic Triage Engaged: Escalation nodes mapped in 3D');
    }, 700);
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
      showToast(`Agent loop executed! Drained queue & updated escalations.`);
      refreshData();
    }
  };

  const handleFeedbackSubmitted = (issueNum, vote) => {
    showToast(`Feedback recorded for #${issueNum} (${vote === 'up' ? 'Confirmed' : 'Overridden'})`);
    refreshData();
  };

  const handleRepoConnected = (newRepo) => {
    showToast(`Connected to ${newRepo}! Launching analysis...`);
    refreshData();
    setAppStage('branch_viz');
  };

  const escalatedCount = issues.filter((i) => i.latest_escalate).length;

  // 1. Initial Space Loading Screen
  if (appStage === 'loading') {
    return (
      <SpaceLoadingScreen
        activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
        onFinish={() => setAppStage('branch_viz')}
      />
    );
  }

  // 2. 3D Git Branch Graph Visualization (Initial Landing after Loading)
  if (appStage === 'branch_viz') {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#06090f]">
        <GitBranchGraph3D
          activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
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

  // 3. Main RepoGuardian App (The Full Categorized 3D Triage Tree + HUD)
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06090f] text-slate-100 font-sans select-none">
      {/* Red Shockwave Transition Out */}
      {isWarpTransitioning && (
        <div className="fixed inset-0 z-50 bg-red-600/30 backdrop-blur-xl animate-fade-out pointer-events-none" />
      )}

      {/* HUD Header Top Navigation */}
      <TopNav
        health={health}
        activeView={activeView}
        onSelectView={setActiveView}
        onSync={handleSync}
        isSyncing={isSyncing}
        onCheckNow={handleCheckNow}
        isChecking={isChecking}
        onOpenConnect={() => setIsConnectOpen(true)}
        issuesCount={issues.length}
        escalatedCount={escalatedCount}
      />

      {/* Main View Area */}
      <main className="w-full h-full relative">
        {activeView === 'topology' && (
          <GitBranchGraph3D
            activeRepo={health?.active_repo || 'demo/repoguardian-seed'}
            onShowIssues={() => setActiveView('3d')}
          />
        )}

        {activeView === '3d' && (
          <div className="w-full h-full">
            <GitTreeScene
              issues={issues}
              selectedIssue={selectedIssue}
              onSelectIssue={setSelectedIssue}
              fallback={
                <ListView2D
                  issues={issues}
                  selectedIssue={selectedIssue}
                  onSelectIssue={setSelectedIssue}
                />
              }
            />
            {/* Top-Left Monitor HUD (shown in 3D mode) */}
            <MonitorPanel
              monitorStatus={monitorStatus}
              onTriggerCheck={handleCheckNow}
              isChecking={isChecking}
            />
          </div>
        )}

        {activeView === 'list' && (
          <ListView2D
            issues={issues}
            selectedIssue={selectedIssue}
            onSelectIssue={setSelectedIssue}
          />
        )}

        {activeView === 'health' && (
          <HealthMetricsView repo={health?.active_repo} />
        )}

        {activeView === 'brief' && (
          <WeeklyBriefView repo={health?.active_repo} />
        )}
      </main>

      {/* Right-Side Issue Detail & Explainability Panel */}
      {selectedIssue && (
        <IssueDetailPanel
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onFeedbackSubmitted={handleFeedbackSubmitted}
        />
      )}

      {/* Floating Bottom View Toggle */}
      {activeView !== 'topology' && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1 rounded-2xl glass-panel border border-white/10 shadow-2xl backdrop-blur-xl">
          <button
            onClick={() => setActiveView('topology')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono text-purple-300 hover:text-purple-100 hover:bg-purple-950/50 transition"
          >
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>Git Branches</span>
          </button>

          <button
            onClick={() => setActiveView('3d')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition ${
              activeView === '3d'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3D Triage Tree</span>
          </button>

          <button
            onClick={() => setActiveView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition ${
              activeView === 'list'
                ? 'bg-sky-500/25 text-sky-200 border border-sky-400/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>2D Triage</span>
          </button>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl glass-panel-glow border border-sky-500/40 text-xs font-mono text-sky-200 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom duration-200">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Connect Repo Modal */}
      <ConnectRepoModal
        isOpen={isConnectOpen}
        onClose={() => setIsConnectOpen(false)}
        onConnected={handleRepoConnected}
      />
    </div>
  );
}
