import type { ComponentChildren } from "preact";
import {
  ArrowLeftRight, Bell, BookOpen, ChevronDown, Cpu, Folder, GitBranch,
  History, House, Inbox, LayoutGrid, PanelLeft, Play, Settings, SquareTerminal,
} from "lucide-preact";
import { openPop, activePanel, activeTab, railOnly, settingsOpen, settingsSection } from "@/app/state";
import { Panels } from "@/features/dock/Panels";
import {
  AppBody, Badge, Button, Rail, RailButton, RailDivider, RailSpacer,
  SidePanel, StatusBar, StatusPill, TitleBar, Wordmark,
} from "@apex/ui";
import type { RailBadge } from "@apex/ui";

const PANELS: { id: string; icon: typeof LayoutGrid; label: string; badge?: RailBadge }[] = [
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
      <TitleBar
        title={<><Wordmark size="sm">APEX</Wordmark> · apex-sandbox</>}
        actions={
          <>
            <Button variant="subtle" size="lg" iconOnly title="Toggle sidebar ⌘B" onClick={() => railOnly.value = !railOnly.value}><PanelLeft size={15} /></Button>
            <Button variant="subtle" size="lg" iconOnly title="Command palette ⌘K"><LayoutGrid size={15} /></Button>
            <Button variant="subtle" size="lg" iconOnly title="Settings ⌘," onClick={() => { settingsOpen.value = true; settingsSection.value = "look"; }}><Settings size={15} /></Button>
          </>
        }
      />

      <AppBody>
        <Rail aria-label="Panels">
          <RailButton
            label="Home"
            current={activeTab.value === "home"}
            onClick={() => activeTab.value = "home"}
          >
            <House size={16} />
          </RailButton>
          <RailDivider />
          {PANELS.map((p) => (
            <RailButton
              key={p.id}
              label={p.label}
              badge={p.badge}
              current={activePanel.value === p.id}
              onClick={() => { activePanel.value = p.id; railOnly.value = false; }}
            >
              <p.icon size={16} />
            </RailButton>
          ))}
          <RailSpacer />
          <RailButton label="main · 16 changed"><GitBranch size={15} /></RailButton>
        </Rail>

        <SidePanel
          hidden={railOnly.value}
          head={
            <button class="proj-btn" title="Switch project"
              onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "projects" ? null : "projects"; }}>
              <span class="proj-glyph"><LayoutGrid size={13} /></span>
              <span class="proj-main">
                <span class="proj-name">apex-sandbox</span>
                <span class="proj-path">~/Documents/Codes/apex-sandbox</span>
              </span>
              <span class="proj-alert" title="1 session waiting in another project" />
              <ChevronDown size={12} style="color:var(--apex-muted);flex:none" />
            </button>
          }
          foot={<Button variant="dashed" size="xl" onClick={() => activeTab.value = "home"}>+ New Session</Button>}
        >
          <Panels />
        </SidePanel>

        {children}
      </AppBody>

      <StatusBar
        right={
          <>
            <StatusPill onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "notifications" ? null : "notifications"; }}>
              <Bell size={11} /><Badge tone="neutral">3</Badge>
            </StatusPill>
            <StatusPill onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "resources" ? null : "resources"; }}>
              <Cpu size={11} />
              <span class="sb-bar"><i class="warn" style="width:23%" /></span>
              <span class="mono">18G</span>
            </StatusPill>
          </>
        }
      >
        <StatusPill title="Switch target"
          onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "target" ? null : "target"; }}>
          <GitBranch size={11} />
          <span class="mono">main</span>
          <span style="color:var(--apex-git-added)">↑2</span>
          <span style="color:var(--apex-state-blocked)">↓0</span>
        </StatusPill>
        <StatusPill onClick={() => activePanel.value = "git"}>
          <span class="mono">16</span> changed
        </StatusPill>
        <StatusPill live interactive={false}>2 racing</StatusPill>
        <StatusPill onClick={(e) => { e.stopPropagation(); openPop.value = openPop.value === "usage" ? null : "usage"; }}>
          <span class="sb-bar"><i style="width:62%" /></span>
          <span class="sb-bar"><i class="warn" style="width:71%" /></span>
          <span class="mono">71%</span>
        </StatusPill>
      </StatusBar>
    </>
  );
}
