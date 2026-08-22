import type { ComponentChildren } from "preact";
import {
  ArrowLeftRight, BookOpen, Folder, GitBranch, History, House, Inbox, LayoutGrid,
  PanelLeft, Play, Plus, Settings, SquareTerminal,
} from "lucide-preact";
import { activePanel, activeTab, paletteOpen, railOnly, settingsOpen, settingsSection } from "@/app/state";
import { Panels } from "@/features/dock/Panels";
import {
  NotificationsPop, ProjectsPop, ResourcesPop, TargetPop, UsagePop,
} from "@/features/workspace/Pops";
import {
  AppBody, Button, Rail, RailButton, RailDivider,
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
            <Button variant="subtle" size="lg" iconOnly title="Command palette ⌘K" onClick={() => paletteOpen.value = true}><LayoutGrid size={15} /></Button>
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
        </Rail>

        <SidePanel
          collapsed={railOnly.value}
          head={<ProjectsPop />}
          foot={
            <Button
              variant="primary"
              size="lg"
              class="w-full"
              title="New session ⌘N"
              onClick={() => activeTab.value = "home"}
            >
              <Plus size={14} />New session
            </Button>
          }
        >
          <Panels />
        </SidePanel>

        {children}
      </AppBody>

      <StatusBar right={<><NotificationsPop /><ResourcesPop /></>}>
        <TargetPop />
        <StatusPill onClick={() => activePanel.value = "git"}>
          <span class="mono">16</span> changed
        </StatusPill>
        <StatusPill live interactive={false}>2 racing</StatusPill>
        <UsagePop />
      </StatusBar>
    </>
  );
}
