import { useState } from "preact/hooks";
import { ArrowLeftRight, Check, ChevronRight, Eye, GitBranch, X } from "lucide-preact";
import {
  activePanel, approvedFirst, committed, gitStaged, launcherOpen,
  pickWinner, raceKept, removedProject,
} from "@/app/state";
import { activeTab, showWelcome } from "@/app/state";
import { AgentIcon, Bar, Button, Card, Dot, ListRow } from "@apex/ui";

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

export const DOCK_PANELS = [
  { id: "summary", label: "Summary", Component: SummaryPanel },
  { id: "sessions", label: "Sessions", Component: SessionsPanel },
  { id: "files", label: "Files", Component: FilesPanel },
  { id: "git", label: "Git · Changes", Component: GitPanel },
  { id: "review", label: "Review", Component: ReviewPanel },
  { id: "race", label: "Races", Component: RacePanel },
  { id: "history", label: "History", Component: HistoryPanel },
  { id: "context", label: "Context", Component: ContextPanel },
  { id: "tasks", label: "Tasks", Component: TasksPanel },
];

export function Panels() {
  const panel = DOCK_PANELS.find((p) => p.id === activePanel.value);
  return panel ? <panel.Component /> : null;
}

function SummaryPanel() {
  return (
    <div class="dock-view active">
      <div style="display:flex;flex-direction:column;padding-top:4px">
        <SumRow icon={<ArrowLeftRight size={14} />} k="Agents" val="4 running"
          sub="antigravity waiting for your approval" nums="1 waiting" panel="sessions" />
        <SumRow icon={<ArrowLeftRight size={14} />} k="Race" val="dock resize jank"
          sub="claude done · codex still working" nums="2 left" tab="tab-race" />
        <SumRow icon={<Eye size={14} />} k="Review" val="2 waiting for you"
          sub="auth middleware · checkout tests" panel="review" />
        <SumRow icon={<GitBranch size={14} />} k="Git" val="main"
          sub="3 staged · commit ready" nums="↑2" panel="git" />
      </div>
      <div class="sec-label">Quotas</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="sum-row" style="padding:4px 6px"><AgentIcon agent="claude" size="sm" /><span style="margin-right:8px">claude</span><Bar value={62} label="claude usage" /><span class="sum-nums">62%</span></div>
        <div class="sum-row" style="padding:4px 6px"><AgentIcon agent="codex" size="sm" /><span style="margin-right:8px">codex</span><Bar value={71} tone="blocked" label="codex usage" /><span class="sum-nums">71%</span></div>
      </div>
      <div class="sec-label">Machine</div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div class="sum-row" style="padding:4px 6px"><span style="margin-right:8px">CPU</span><Bar value={23} tone="done" label="CPU" /><span class="sum-nums">23%</span></div>
        <div class="sum-row" style="padding:4px 6px"><span style="margin-right:8px">RAM</span><Bar value={56} label="RAM" /><span class="sum-nums">18/32G</span></div>
      </div>
    </div>
  );
}

function SessionsPanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Running <span>· 2</span></div>
      <ListRow label="Refactor auth middleware" lead={<Dot state="blocked" />} trail={<span class="mono">2m</span>}
        onClick={() => { showWelcome.value = false; activeTab.value = "tab-auth"; }} />
      <ListRow label="Fix flaky checkout tests" selected lead={<Dot state="working" />} trail={<span class="mono">14m</span>}
        onClick={() => { showWelcome.value = false; activeTab.value = "tab-auth"; }} />
      <div class="sec-label">Worktrees <span>· 3</span></div>
      {["apex/claude", "apex/codex", "apex/antigravity"].map((b, i) => (
        <ListRow key={b} label={b} class="font-mono"
          lead={<GitBranch size={13} style="color:var(--apex-muted)" />}
          trail={<span>{[3, 5, 0][i]}</span>} />
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
          <GitBranch size={12} style="color:var(--apex-muted)" />
          <span class="mono" style="font-size:11.5px">main</span>
          <span style="color:var(--apex-git-added)" class="mono">↑2</span>
          <span style="flex:1" />
          <button class="syn-btn" title="Pull"><ChevronRight size={12} style="transform:rotate(90deg)" /></button>
        </div>
        <div class="sec-label" style="padding-top:4px">Staged <span>· {staged ? 3 : 4}</span></div>
        {(staged ? STAGED : [...STAGED.slice(0, 1), CHANGES[0], ...STAGED.slice(1)]).map((f) => (
          <ListRow as="div" key={f} class="font-mono staged" label={String(f.split(" ").slice(0, 1))}
            lead={<span class="stage-box"><Check size={9} strokeWidth={3} /></span>} />
        ))}
        <div class="sec-label">Changes <span>· {staged ? 4 : 3}</span></div>
        {(staged ? CHANGES : CHANGES.slice(1)).map((f) => (
          <ListRow as="div" key={f} class="font-mono" label={String(f.split(" ").slice(0, 1))}
            lead={<span class="stage-box"><Check size={9} strokeWidth={3} /></span>} />
        ))}
      </div>
      <div class="commit-dock">
        <textarea class="commit-msg" placeholder="Commit message… (⌘↵)" />
        <div class="commit-foot">
          <span class="commit-count">
            {committed.value ?? `${staged ? 3 : 4} staged on main`}
          </span>
          <Button variant="primary" onClick={() => committed.value = `Committed as ${Math.random().toString(16).slice(2, 9)}`}>Commit</Button>
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
          <AgentIcon agent={i === 0 ? "opencode" : "claude"} size="sm" />
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
      <Card elevation="raised">
        <div class="rev-title" style="font-weight:600">“Fix the dock resize jank”</div>
        <div class="rev-meta">2 contenders · no prompts · 4m 12s</div>
      </Card>
      <div class="rev-row">
        <AgentIcon agent="claude" size="sm" />
        <div class="rev-info">
          <div class="rev-title">claude</div>
          <div class="rev-meta mono">{pickWinner.value ? "kept · tests 48 ✓" : "14 files · tests 48 ✓"}</div>
        </div>
        {!pickWinner.value && (
          <Button size="xs" onClick={() => pickWinner.value = true}>Keep claude</Button>
        )}
      </div>
      <div class="rev-row">
        <AgentIcon agent="codex" size="sm" />
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
      <Card elevation="raised"><div class="rev-meta mono" style="margin:0">bun install<br />bun run dev<br />bun test</div></Card>
      <div class="sec-label">Pinned <span>· 2</span></div>
      {["tokens.css 3.1k", "race.proto 1.8k"].map((f) => (
        <ListRow as="div" key={f} class="font-mono" label={f.split(" ")[0]} trail={<span>{f.split(" ")[1]}</span>} />
      ))}
    </div>
  );
}

function TasksPanel() {
  return (
    <div class="dock-view active">
      <div class="sec-label" style="padding-top:4px">Active <span>· 2</span></div>
      <ListRow as="div" class="font-mono" label="bun run dev" sub="watching · rebuilt 2s ago"
        lead={<Dot state="working" />}
        trail={<button class="url-chip" title="Open localhost:5173 in a pane"
          onClick={() => { showWelcome.value = false; activeTab.value = "tab-browser"; }}>:5173</button>} />
      <ListRow as="div" class="font-mono" label="bun test --watch" sub="paused" lead={<Dot state="idle" />} />
    </div>
  );
}
