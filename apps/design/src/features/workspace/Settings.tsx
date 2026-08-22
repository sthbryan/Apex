import { BookOpenText, Bot, CircleHelp, Globe, Keyboard, Server, Sparkles, X } from "lucide-preact";
import { themeMode, veil } from "@/shared/theme/mode";
import { settingsOpen, settingsSection, updateState } from "@/app/state";
import {
  AgentIcon, Button, Field, Kbd, Pill, Segmented, SettingsDialog, SettingsHeading,
  Slider, Select, Switch,
} from "@apex/ui";

const SECTIONS = [
  { id: "look", label: "Look", Icon: Sparkles },
  { id: "workspace", label: "Workspace", Icon: Globe },
  { id: "agents", label: "Agents", Icon: Bot },
  { id: "daemon", label: "Daemon", Icon: Server },
  { id: "shortcuts", label: "Shortcuts", Icon: Keyboard },
  { id: "about", label: "About", Icon: CircleHelp },
] as const;

export function SettingsModal({ inline }: { inline?: boolean } = {}) {
  return (
    <SettingsDialog
      open
      modal={!inline}
      onClose={() => settingsOpen.value = false}
      sections={SECTIONS.map(({ id, label, Icon }) => ({ id, label, icon: <Icon size={14} strokeWidth={1.75} /> }))}
      section={settingsSection.value}
      onSection={(id) => settingsSection.value = id}
      close={<Button variant="subtle" size="lg" iconOnly title="Close" onClick={() => settingsOpen.value = false}><X size={13} /></Button>}
    >
      {settingsSection.value === "look" && <LookSection />}
      {settingsSection.value === "workspace" && <WorkspaceSection />}
      {settingsSection.value === "agents" && <AgentsSection />}
      {settingsSection.value === "daemon" && <DaemonSection />}
      {settingsSection.value === "shortcuts" && <ShortcutsSection />}
      {settingsSection.value === "about" && <AboutSection />}
    </SettingsDialog>
  );
}

function SetRow({ label, desc, children }: { label: string; desc?: string; children: any }) {
  return <Field label={label} hint={desc}>{children}</Field>;
}

function LookSection() {
  return (
    <div class="set-section">
      <SettingsHeading title="Look" sub="How Apex feels on this machine." />
      <SetRow label="Theme" desc="Applies instantly, saved for next time.">
        <Segmented
          label="Theme"
          options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          value={themeMode.value}
          onChange={(v) => (themeMode.value = v as "light" | "dark")}
        />
      </SetRow>
      <SetRow label="Text size">
        <Segmented label="Text size" options={[{ value: "compact", label: "Compact" }, { value: "normal", label: "Normal" }, { value: "roomy", label: "Roomy" }]} value="compact" onChange={() => {}} />
      </SetRow>
      <SetRow label="Translucent window" desc="Let the desktop show through the chrome.">
        <Switch label="Translucent window" checked={veil.value === "on"} onChange={(v) => (veil.value = v ? "on" : "off")} />
      </SetRow>
      <SetRow label="Transparency">
        <Slider label="Transparency" value={76} onChange={() => {}} />
      </SetRow>
      <SetRow label="Blur">
        <Slider label="Blur" value={26} max={40} unit="px" onChange={() => {}} />
      </SetRow>
      <SetRow label="Language">
        <Segmented label="Language" options={[{ value: "en", label: "English" }, { value: "es", label: "Español" }]} value="en" onChange={() => {}} />
      </SetRow>
    </div>
  );
}

function WorkspaceSection() {
  return (
    <div class="set-section">
      <SettingsHeading title="Workspace" sub="Where files, previews and agent views go." />
      <SetRow label="External editor">
        <Select
          label="External editor"
          options={[
            { value: "system", label: "System default" },
            { value: "cursor", label: "Cursor" },
            { value: "vscode", label: "VS Code" },
          ]}
        />
      </SetRow>
      <SetRow label="Web previews" desc="localhost links open…">
        <Segmented label="Web previews" options={[{ value: "pane", label: "In a pane" }, { value: "browser", label: "System browser" }]} value="pane" onChange={() => {}} />
      </SetRow>
      <SetRow label="Views an agent asks for">
        <Segmented label="Views an agent asks for" options={[{ value: "tab", label: "New tab" }, { value: "split", label: "Split the tab" }]} value="split" onChange={() => {}} />
      </SetRow>
      <SetRow label="Races skip permission prompts" desc="Contenders run unsupervised in their worktrees.">
        <Switch label="Races skip permission prompts" checked onChange={() => {}} />
      </SetRow>
      <SetRow label="Notifications">
        <Switch label="Notifications" checked onChange={() => {}} />
      </SetRow>
    </div>
  );
}

const AGENTS = [
  { id: "claude", name: "claude", ver: "2.0.14", shares: true, mode: "acp" },
  { id: "codex", name: "codex", ver: "0.9.2", shares: false, mode: "tty" },
  { id: "antigravity", name: "antigravity", ver: "0.8.0", shares: true, mode: "tty" },
  { id: "opencode", name: "opencode", ver: "0.7.1", shares: true, mode: "acp" },
] as const;

function AgentsSection() {
  return (
    <div class="set-section">
      <SettingsHeading title="Agents" sub="Rendering belongs to each agent — native when it speaks ACP, terminal otherwise." />
      {AGENTS.map((a) => (
        <div class="agent-set-row" key={a.id}>
          <AgentIcon agent={a.id} size="md" />
          <div style="flex:1;min-width:0">
            <div class="as-name">{a.name} <span class="as-ver">{a.ver}</span></div>
          </div>
          <Pill tone={a.shares ? "accent" : "neutral"} title="Shares context">shares context</Pill>
          {a.mode === "acp" ? (
            <Segmented label={`${a.name} rendering`} options={[{ value: "tty", label: "Terminal" }, { value: "acp", label: "Native" }]} value="acp" onChange={() => {}} />
          ) : (
            <Segmented label={`${a.name} rendering`} options={[{ value: "tty", label: "Terminal" }, { value: "acp", label: "Native" }]} value="tty" onChange={() => {}} />
          )}
        </div>
      ))}
    </div>
  );
}

function DaemonSection() {
  return (
    <div class="set-section">
      <SettingsHeading title="Daemon" sub="The background service keeping sessions alive." />
      <SetRow label="Daemon background time" desc="After you close Apex, agents keep running for this long.">
        <Segmented
          label="Daemon background time"
          options={[{ value: "stop", label: "Stop on close" }, { value: "60", label: "60 s" }, { value: "2h", label: "2 h" }]}
          value="60"
          onChange={() => {}}
        />
      </SetRow>
    </div>
  );
}

const SHORTCUTS: { group: string; rows: [string, string[]][] }[] = [
  {
    group: "Navigation",
    rows: [
      ["Command palette", ["⌘", "K"]],
      ["Find a file", ["⌘", "P"]],
      ["Settings", ["⌘", ","]],
      ["Subscription usage", ["⌘", "U"]],
      ["Toggle sidebar", ["⌘", "B"]],
      ["Switch tab", ["⌘", "1…9"]],
    ],
  },
  {
    group: "Panes",
    rows: [
      ["Split right", ["⌘", "D"]],
      ["Split down", ["⌘", "⇧", "D"]],
      ["Cycle layout", ["⌘", "⇧", "L"]],
      ["Close pane", ["⌘", "W"]],
    ],
  },
];

function ShortcutsSection() {
  return (
    <div class="set-section">
      <SettingsHeading title="Keyboard shortcuts" sub="Everything reachable without the mouse." />
      {SHORTCUTS.map(({ group, rows }) => (
        <div key={group}>
          <div class="pl-label" style="padding-left:0">{group}</div>
          {rows.map(([label, keys]) => (
            <div class="sc-row" key={label}>
              <span class="sc-label">{label}</span>
              <span class="keys">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function AboutSection() {
  const checking = updateState.value === "Checking…";
  return (
    <div class="set-section">
      <SettingsHeading title="About" sub="What is running on this machine." />
      <div class="set-row" style="border:0;padding-top:0">
        <div>
          <div class="set-label" style="font-size:15px;font-weight:700;letter-spacing:.08em;display:flex;align-items:center;gap:8px">
            <BookOpenText size={16} strokeWidth={1.75} /> APEX
          </div>
          <div class="set-desc">Run a team of AI agents, not a wall of terminals.</div>
        </div>
        <Button
          variant="primary"
          disabled={checking}
          onClick={() => {
            updateState.value = "Checking…";
            setTimeout(() => (updateState.value = "You are up to date · just now"), 1200);
          }}
        >
          {checking ? "Checking…" : "Check for updates"}
        </Button>
      </div>
      <dl>
        <div class="fact-row"><dt>App</dt><dd>0.5.0 (design lab)</dd></div>
        <div class="fact-row"><dt>apexd</dt><dd>0.5.0</dd></div>
        <div class="fact-row"><dt>Agent files</dt><dd>~/.apex/agents</dd></div>
        <div class="fact-row"><dt>Updates</dt><dd>{updateState.value}</dd></div>
      </dl>
    </div>
  );
}
