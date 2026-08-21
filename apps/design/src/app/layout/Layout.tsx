import type { ComponentChildren } from "preact";
import {
  ArrowLeftRight, Bell, BookOpen, ChevronDown, Cpu, Folder, GitBranch,
  History, Inbox, LayoutGrid, PanelLeft, Play, Settings, SquareTerminal,
} from "lucide-preact";
import { openPop, page, activePanel, railOnly, showWelcome } from "@/app/state";
import { Panels } from "@/features/dock/Panels";

const PANELS = [
  { id: "summary", icon: LayoutGrid, label: "Summary" },
  { id: "sessions", icon: SquareTerminal, label: "Sessions", badge: "blocked" },
  { id: "files", icon: Folder, label: "Files" },
  { id: "git", icon: GitBranch, label: "Git · Changes", badge: "dirty" },
  { id: "review", icon: Inbox, label: "Review", badge: "done" },
  { id: "race", icon: ArrowLeftRight, label: "Races", badge: "working" },
  { id: "history", icon: History, label: "History" },
  { id: "context", icon: BookOpen, label: "Context" },
  { id: "tasks", icon: Play, label: "Tasks", badge: "working" },
];

export function Layout({ children }: { children: ComponentChildren }) {
  return (
    <>
      <header class="titlebar chrome-blur">
        <div class="lights" aria-hidden="true"><i /><i /><i /></div>
        <div class="titlebar-title"><strong>APEX</strong> — apex-sandbox</div>
        <div class="tb-actions">
          <button class="icon-btn" title="Toggle sidebar ⌘B" onClick={() => railOnly.value = !railOnly.value}><PanelLeft size={15} /></button>
          <button class="icon-btn" title="Command palette ⌘K"><LayoutGrid size={15} /></button>
          <button class="icon-btn" title="Settings ⌘,"><Settings size={15} /></button>
        </div>
      </header>

      <div class="app">
        <nav class="rail chrome-blur" aria-label="Panels">
          {PANELS.map((p) => (
            <button key={p.id} class="picon" aria-current={activePanel.value === p.id}
              onClick={() => { activePanel.value = p.id; railOnly.value = false; }}>
              <p.icon size={16} />
              {p.badge && <span class={`bdot ${p.badge}`} />}
              <span class="tip">{p.label}</span>
            </button>
          ))}
          <div style="flex:1" />
          <button class="picon" title="main · 16 changed">
            <GitBranch size={15} />
          </button>
        </nav>

        <aside class="dock chrome-blur" hidden={railOnly.value}>
          <div class="ws-head">
            <div class="ws-head-row">
              <button class="proj-btn" title="Switch project"
                onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "projects" ? null : "projects"; }}>
                <span class="proj-glyph"><LayoutGrid size={13} /></span>
                <span class="proj-main">
                  <span class="proj-name">apex-sandbox</span>
                  <span class="proj-path">~/Documents/Codes/apex-sandbox</span>
                </span>
                <span class="proj-alert" title="1 session waiting in another project" />
                <ChevronDown size={12} style="color:var(--muted);flex:none" />
              </button>
            </div>
          </div>

          <div class="dock-views">
            <Panels />
          </div>

          <div class="dock-foot">
            <button class="cta-btn" onClick={() => showWelcome.value = true}>+ New Session</button>
          </div>
        </aside>

        {children}
      </div>

      <footer class="statusbar chrome-blur">
        <button class="sb-pill" title="Switch target"
          onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "target" ? null : "target"; }}>
          <GitBranch size={11} />
          <span class="mono">main</span>
          <span style="color:var(--added)">↑2</span>
          <span style="color:var(--blocked)">↓0</span>
        </button>
        <button class="sb-pill" onClick={() => activePanel.value = "git"}>
          <span class="mono">16</span> changed
        </button>
        <span class="sb-pill live"><i /> 2 racing</span>
        <button class="sb-pill" onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "usage" ? null : "usage"; }}>
          <span class="sb-bar"><i style="width:62%" /></span>
          <span class="sb-bar"><i class="warn" style="width:71%" /></span>
          <span class="mono">71%</span>
        </button>
        <div class="sb-right">
          <button class="sb-pill" onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "notifications" ? null : "notifications"; }}>
            <Bell size={11} /><span class="sb-badge">3</span>
          </button>
          <button class="sb-pill" onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "resources" ? null : "resources"; }}>
            <Cpu size={11} />
            <span class="sb-bar"><i class="warn" style="width:23%" /></span>
            <span class="mono">18G</span>
          </button>
        </div>
      </footer>
    </>
  );
}
