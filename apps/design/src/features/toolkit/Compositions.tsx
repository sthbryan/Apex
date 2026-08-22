import { Check, FileText, GitBranch, Lock, Send, Settings } from "lucide-preact";
import {
  AgentIcon, Badge, Button, Card, Checkbox, Chip, Composer, DiffFile, DiffHunk, DiffLine,
  DiffView, Dot, EmptyState, Field, Kbd, KbdGroup, ListRow, Meter, Pane, Pill, SectionLabel,
  Segmented, SidePanel, Slider, StatePill, StatusBar, StatusPill, Switch, TitleBar,
  ToggleChip, ToggleChipGroup, Toast, Toolbar, Wordmark,
} from "@apex/ui";

export interface Composition {
  name: string;
  rule: string;
  render: () => any;
}

export const COMPOSITIONS: Composition[] = [
  {
    name: "Session pane",
    rule: "Identity in the header, state on the right, the reply always within reach at the foot.",
    render: () => (
      <Pane
        class="h-72 rounded-md border border-border overflow-hidden"
        title="Refactor auth middleware"
        sub={<><Chip>⎇ apex/claude</Chip><span class="mono">2m 14s</span></>}
        lead={<AgentIcon agent="claude" />}
        actions={<StatePill state="blocked">Waiting</StatePill>}
        foot={
          <Composer
            label="Reply to claude"
            placeholder="Reply to claude…"
            rows={1}
            class="rounded-none border-0 shadow-none"
            actions={<Button variant="primary" size="sm" iconOnly aria-label="Send"><Send size={13} /></Button>}
          />
        }
      >
        <div class="flex flex-col gap-3 p-3">
          <Card elevation="raised" class="self-end max-w-[82%]">
            Use passkeys instead of session cookies.
          </Card>
          <Card title="Run a migration on the dev database?" lead={<Lock size={13} />}>
            <span class="mono text-xs">bun run db:migrate --name passkeys</span>
            <div class="mt-3 flex gap-2">
              <Button variant="primary" size="sm">Yes, run it</Button>
              <Button variant="danger" size="sm">Deny</Button>
            </div>
          </Card>
        </div>
      </Pane>
    ),
  },
  {
    name: "Dock panel",
    rule: "Groups get a SectionLabel only when there are two of them. The panel never holds the primary action.",
    render: () => (
      <SidePanel
        class="h-72 rounded-md border border-border overflow-hidden"
        width={260}
        foot={<Button variant="dashed" size="xl">+ New Session</Button>}
      >
        <SectionLabel count={2}>Running</SectionLabel>
        <ListRow label="Refactor auth middleware" lead={<Dot state="blocked" />} trail={<span class="mono">2m</span>} />
        <ListRow label="Fix flaky checkout tests" selected lead={<Dot state="working" />} trail={<span class="mono">14m</span>} />
        <SectionLabel count={3}>Worktrees</SectionLabel>
        {["apex/claude", "apex/codex", "apex/antigravity"].map((b, i) => (
          <ListRow key={b} class="font-mono" label={b}
            lead={<GitBranch size={13} style="color:var(--apex-muted)" />}
            trail={<span>{[3, 5, 0][i]}</span>} />
        ))}
      </SidePanel>
    ),
  },
  {
    name: "Review diff",
    rule: "The path is never optional. Stat sits with the path, actions sit with the hunk.",
    render: () => (
      <Pane
        class="h-72 rounded-md border border-border overflow-hidden"
        lead={<GitBranch size={12} style="color:var(--apex-muted)" />}
        title="apex/claude · DockResize.tsx"
        actions={<><Chip>staged</Chip><span class="mono text-xs">2 / 4</span></>}
      >
        <DiffView>
          <DiffFile path="apps/desktop/…/DockResize.tsx" added={24} removed={11}>
            <DiffHunk range="@@ -12,7 +12,9 @@" actions={<Button size="xs">Stage hunk</Button>} />
            <DiffLine kind="ctx">{"  const onPointer = (event) => {"}</DiffLine>
            <DiffLine kind="del">{"-    setWidth(event.clientX - origin);"}</DiffLine>
            <DiffLine kind="add">{"+    const next = clamp(event.clientX - origin, rail, max);"}</DiffLine>
            <DiffLine kind="ctx">{"  };"}</DiffLine>
          </DiffFile>
        </DiffView>
      </Pane>
    ),
  },
  {
    name: "Settings group",
    rule: "Grouped by what the user is changing. Every control applies on the spot.",
    render: () => (
      <Card class="h-72 overflow-y-auto" elevation="surface">
        <Field label="Theme" hint="Applies instantly, saved for next time.">
          <Segmented label="Theme" value="dark" onChange={() => {}}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        </Field>
        <Field label="Translucent window" hint="Let the desktop show through the chrome.">
          <Switch label="Translucent window" checked onChange={() => {}} />
        </Field>
        <Field label="Transparency">
          <Slider label="Transparency" value={76} onChange={() => {}} />
        </Field>
        <Field label="Command palette">
          <KbdGroup keys={["⌘", "K"]} />
        </Field>
      </Card>
    ),
  },
  {
    name: "Window chrome",
    rule: "Wordmark and window actions in the title bar; ambient state in the status bar, never a sole path.",
    render: () => (
      <div class="flex h-72 flex-col overflow-hidden rounded-md border border-border">
        <TitleBar
          title={<><Wordmark size="sm">APEX</Wordmark> <span class="text-muted">· apex-sandbox</span></>}
          actions={<Button variant="subtle" size="lg" iconOnly aria-label="Settings"><Settings size={15} /></Button>}
        />
        <div class="flex-1 grid place-items-center bg-bg">
          <EmptyState title="No sessions yet" detail="Start a task and it will show up here."
            actions={<Button variant="primary" size="sm">New session</Button>} />
        </div>
        <StatusBar right={<StatusPill><Badge tone="neutral">3</Badge></StatusPill>}>
          <StatusPill><GitBranch size={11} /><span class="mono">main</span></StatusPill>
          <StatusPill live interactive={false}>2 racing</StatusPill>
        </StatusBar>
      </div>
    ),
  },
  {
    name: "Launch a race",
    rule: "Multi-select is ToggleChip, the count is prose, and there is exactly one primary.",
    render: () => (
      <Card class="h-72" elevation="surface">
        <Composer
          label="Task"
          placeholder="Fix the dock resize jank"
          lead={
            <ToggleChipGroup label="Contenders">
              <ToggleChip pressed size="sm" lead={<AgentIcon agent="claude" size="xs" />} trail={<Check size={11} />}>claude</ToggleChip>
              <ToggleChip pressed size="sm" lead={<AgentIcon agent="codex" size="xs" />} trail={<Check size={11} />}>codex</ToggleChip>
              <ToggleChip pressed={false} size="sm" lead={<AgentIcon agent="grok" size="xs" />}>grok</ToggleChip>
            </ToggleChipGroup>
          }
        />
        <div class="mt-3 flex items-center gap-2">
          <span class="flex-1 text-xs text-muted">2 agents · one worktree each</span>
          <Button variant="primary" size="sm">Start race</Button>
        </div>
        <div class="mt-3 flex flex-col gap-1.5">
          <Meter label="claude" value={62} tick={58} />
          <Meter label="codex" value={71} tone="blocked" />
        </div>
      </Card>
    ),
  },
  {
    name: "Staging list",
    rule: "Checkbox for staging, Badge for the change kind, the commit action pinned to the foot.",
    render: () => (
      <SidePanel
        class="h-72 rounded-md border border-border overflow-hidden"
        width={260}
        foot={
          <div class="flex items-center gap-2">
            <span class="flex-1 text-xs text-muted">3 staged on main</span>
            <Button variant="primary" size="sm">Commit</Button>
          </div>
        }
      >
        <SectionLabel count={3}>Staged</SectionLabel>
        {["DockResize.tsx", "race/state.ts", "RaceView.tsx"].map((f) => (
          <ListRow key={f} as="div" class="font-mono" label={f}
            lead={<Checkbox checked label={`Stage ${f}`} onChange={() => {}} />}
            trail={<Badge tone="modified">M</Badge>} />
        ))}
        <SectionLabel count={1}>Changes</SectionLabel>
        <ListRow as="div" class="font-mono" label="tokens.css"
          lead={<Checkbox checked={false} label="Stage tokens.css" onChange={() => {}} />}
          trail={<Badge tone="added">A</Badge>} />
      </SidePanel>
    ),
  },
  {
    name: "Finished notice",
    rule: "A toast reports; it never asks. The follow-up action lives where the work is.",
    render: () => (
      <div class="grid h-72 place-items-center">
        <div class="flex flex-col gap-2">
          <Toast title="Codex finished" detail="Fix the race settle flow · exit 0" tone="done"
            lead={<AgentIcon agent="codex" size="sm" />} onDismiss={() => {}} />
          <Toast title="Build failed" detail="exit 1" tone="failed"
            lead={<AgentIcon agent="claude" size="sm" />} onDismiss={() => {}} />
        </div>
      </div>
    ),
  },
];
