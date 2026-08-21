import { useState } from "preact/hooks";
import { ArrowLeftRight, Check, ChevronRight, Eye, GitBranch, X } from "lucide-preact";
import {
  activePanel, approvedFirst, committed, gitStaged, launcherOpen,
  pickWinner, raceKept, removedProject,
} from "@/app/state";
import { activeTab, showWelcome } from "@/app/state";
import { Bar, Dot, Glyph } from "@/shared/ui/atoms";

function SumRow({ icon, k, val, sub, nums, ...go }: {
  icon: any; k: string; val: any; sub?: string; nums?: string;
  panel?: string; tab?: string;
}) {
  return (
    <button class="sum-row" onClick={() => {
      if (go.panel) activePanel.value = go.panel;
      if (go.tab) { showWelcome.value = false; activeTab.value = go.tab; }
    }}>
      <span class="sum-ico">{icon}</span>
      <span class="sum-key">{k}</span>
      <span class="sum-val">{val}{sub && <span class="sub">{sub}</span>}</span>
      {nums && <span class="sum-nums">{nums}</span>}
    </button>
  );
}

export function Panels() {
  const p = activePanel.value;
  return (
    <>
      {p === "summary" && <SummaryPanel />}
      {p === "sessions" && <SessionsPanel />}
      {p === "files" && <FilesPanel />}
      {p === "git" && <GitPanel />}
      {p === "review" && <ReviewPanel />}
      {p === "race" && <RacePanel />}
      {p === "history" && <HistoryPanel />}
      {p === "context" && <ContextPanel />}
      {p === "tasks" && <TasksPanel />}
    </>
  );
}

function SummaryPanel() {
  return (
    <div class="dock-view active">
      <div style="display:flex;flex-direction:column;padding-top:4px">
        <SumRow icon={<ArrowLeftRight size={14} />} k="Agents" val="4 running"
          sub="gemini waiting for your approval" nums="1 waiting" panel="sessions" />
        <SumRow icon={<ArrowLeftRight size={14} />} k="Race" val="dock resize jank"
          sub="claude done · codex still working" nums="2 left" tab="tab-race" />
        <SumRow icon={<Eye size={14} />} k="Review" val="2 waiting for you"
          sub="auth middleware · checkout tests" panel="review" />
        <SumRow icon={<GitBranch size={14} />} k="Git" val="main"
          sub="3 staged · commit ready" nums="↑2" panel="git" />
      </div>
      <div class="sec-label">Quotas</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="sum-row" style="padding:4px 6px"><Glyph agent="claude" mini /><span style="margin-right:8px">claude</span><Bar width="62%" /><span class="sum-nums">62%</span></div>
        <div class="sum-row" style="padding:4px 6px"><Glyph agent="codex" mini /><span style="margin-right:8px">codex</span><Bar tone="warn" width="71%" /><span class="sum-nums">71%</span></div>
      </div>
      <div class="sec-label">Machine</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="sum-row" style="padding:4px 6px"><span style="margin-right:8px">CPU</span><Bar tone="ok" width="23%" /><span class="sum-nums">23%</span></div>
        <div class="sum-row" style="padding:4px 6px"><span style="margin-right:8px">RAM</span><Bar width="56%" /><span class="sum-nums">18/32G</span></div>
      </div>
    </div>
  );
}

function SessionsPanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Running <span>· 2</span></div>
      <button class="row" onClick={() => { showWelcome.value = false; activeTab.value = "tab-auth"; }}>
        <Dot state="blocked" /><span class="row-label">Refactor auth middleware</span><span class="row-meta mono">2m</span>
      </button>
      <button class="row" aria-selected="true" onClick={() => { showWelcome.value = false; activeTab.value = "tab-auth"; }}>
        <Dot state="working" /><span class="row-label">Fix flaky checkout tests</span><span class="row-meta mono">14m</span>
      </button>
      <div class="sec-label">Worktrees <span>· 3</span></div>
      {["apex/claude", "apex/codex", "apex/gemini"].map((b, i) => (
        <button class="row" key={b}>
          <GitBranch size={13} style="color:var(--muted);flex:none" />
          <span class="row-label mono">{b}</span>
          <span class="row-meta">{[3, 5, 0][i]}</span>
        </button>
      ))}
    </div>
  );
}

function FilesPanel() {
  return (
    <div class="dock-view active">
      <button class="commit-row" style="margin-top:6px"><ChevronRight size={10} style="transform:rotate(90deg)" />apps/desktop</button>
      <button class="commit-row" style="padding-left:20px">src/shared/theme</button>
      <button class="commit-row" style="padding-left:32px"><span class="chash">css</span>tokens.css</button>
      <button class="commit-row" style="padding-left:32px"><span class="chash">css</span>theme.css</button>
      <button class="commit-row"><ChevronRight size={10} />crates/apex-core</button>
    </div>
  );
}

const STAGED = ["DockResize.tsx +24 −11", "race/state.ts +96", "RaceView.tsx +112"];
const CHANGES = ["tokens.css +9 −2", "theme.css +31 −7", "DockChrome.ts −54", "en.ts +6"];

function GitPanel() {
  const staged = gitStaged.value;
  return (
    <div class="dock-view git-flex active">
      <div class="git-scroll">
        <div class="sync-row">
          <GitBranch size={12} style="color:var(--muted)" />
          <span class="mono" style="font-size:11.5px">main</span>
          <span style="color:var(--added)" class="mono">↑2</span>
          <span style="flex:1" />
          <button class="syn-btn" title="Pull"><ChevronRight size={12} style="transform:rotate(90deg)" /></button>
        </div>
        <div class="sec-label" style="padding-top:4px">Staged <span>· {staged ? 3 : 4}</span></div>
        {(staged ? STAGED : [...STAGED.slice(0, 1), CHANGES[0], ...STAGED.slice(1)]).map((f) => (
          <div class="row staged" key={f}>
            <span class="stage-box"><Check size={9} strokeWidth={3} /></span>
            <span class="row-label mono">{f.split(" ").slice(0, 1)}</span>
          </div>
        ))}
        <div class="sec-label">Changes <span>· {staged ? 4 : 3}</span></div>
        {(staged ? CHANGES : CHANGES.slice(1)).map((f) => (
          <div class="row" key={f}>
            <span class="stage-box"><Check size={9} strokeWidth={3} /></span>
            <span class="row-label mono">{f.split(" ").slice(0, 1)}</span>
          </div>
        ))}
      </div>
      <div class="commit-dock">
        <textarea class="commit-msg" placeholder="Commit message… (⌘↵)" />
        <div class="commit-foot">
          <span class="commit-count">
            {committed.value ?? `${staged ? 3 : 4} staged on main`}
          </span>
          <button class="btn btn-primary" onClick={() => committed.value = `Committed as ${Math.random().toString(16).slice(2, 9)}`}>Commit</button>
        </div>
      </div>
    </div>
  );
}

function ReviewPanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Waiting on you <span>· 2</span></div>
      {[0, 1].map((i) => (
        <div class="rev-row" key={i} style={approvedFirst.value && i === 0 ? { opacity: .6 } : undefined}>
          <Glyph agent={i === 0 ? "opencode" : "claude"} mini />
          <div class="rev-info">
            <div class="rev-title">{i === 0 ? "Refactor auth middleware" : "Fix flaky checkout tests"}</div>
            <div class="rev-meta">{approvedFirst.value && i === 0 ? "approved" : `apex/${i === 0 ? "claude" : "codex"} · ${i === 0 ? 4 : 2} files`}</div>
          </div>
          <span class="fadd">+{i === 0 ? 38 : 14}</span>
          <span class="fdel">−{i === 0 ? 6 : 9}</span>
          {!approvedFirst.value && (
            <span class="rev-acts">
              <button class="rev-act" title="Open the diff"><Eye size={12} /></button>
              <button class="rev-act reject" title="Reject"><X size={12} /></button>
              <button class="rev-act approve" title="Approve" onClick={() => approvedFirst.value = true}><Check size={12} /></button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RacePanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Running <span>· 1</span></div>
      <div class="card" style="padding:9px 10px">
        <div class="rev-title" style="font-weight:600">“Fix the dock resize jank”</div>
        <div class="rev-meta">2 contenders · no prompts · 4m 12s</div>
      </div>
      <div class="rev-row">
        <Glyph agent="claude" mini />
        <div class="rev-info">
          <div class="rev-title">claude</div>
          <div class="rev-meta mono">{pickWinner.value ? "kept · tests 48 ✓" : "14 files · tests 48 ✓"}</div>
        </div>
        {!pickWinner.value && (
          <button class="btn btn-ghost" style="height:22px;font-size:10.5px" onClick={() => pickWinner.value = true}>Keep claude</button>
        )}
      </div>
      <div class="rev-row">
        <Glyph agent="codex" mini />
        <div class="rev-info"><div class="rev-title">codex</div><div class="rev-meta mono">still working · tests 31 ✓</div></div>
        <Dot state="working" />
      </div>
      <button class="cta-btn" style="margin-top:8px" onClick={() => launcherOpen.value = true}>+ Race a task across agents</button>
    </div>
  );
}

function HistoryPanel() {
  const commits = [
    ["31efc53", "let a race go once a contender is left", "2h"],
    ["db97013", "keep one contender and drop the rest", "2h"],
    ["5e28bbb", "show the contenders side by side", "5h"],
    ["2a261e8", "count what each contender changed", "5h"],
    ["78f121c", "give races their own dock panel", "1d"],
  ];
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Recent · main</div>
      {commits.map(([sha, msg, when]) => (
        <button class="commit-row" key={sha}>
          <span class="chash">{sha}</span><span class="cmsg">{msg}</span><span class="ctime">{when}</span>
        </button>
      ))}
    </div>
  );
}

function ContextPanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">AGENTS.md</div>
      <div class="card"><div class="rev-meta mono" style="margin:0">bun install<br />bun run dev<br />bun test</div></div>
      <div class="sec-label">Pinned <span>· 2</span></div>
      {["tokens.css 3.1k", "race.proto 1.8k"].map((f) => (
        <div class="row" key={f}>
          <span class="row-label mono">{f.split(" ")[0]}</span><span class="row-meta">{f.split(" ")[1]}</span>
        </div>
      ))}
    </div>
  );
}

function TasksPanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Active <span>· 2</span></div>
      <div class="row">
        <Dot state="working" />
        <div style="flex:1;min-width:0">
          <div class="row-label mono" style="color:var(--text)">bun run dev</div>
          <div class="row-meta">watching · rebuilt 2s ago</div>
        </div>
        <button class="url-chip" title="Open localhost:5173 in a pane"
          onClick={() => { showWelcome.value = false; activeTab.value = "tab-browser"; }}>:5173</button>
      </div>
      <div class="row">
        <Dot state="idle" />
        <div style="flex:1;min-width:0">
          <div class="row-label mono" style="color:var(--text)">bun test --watch</div>
          <div class="row-meta">paused</div>
        </div>
      </div>
    </div>
  );
}
