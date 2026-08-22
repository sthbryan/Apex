import { useState } from "preact/hooks";
import { Bot, CircleHelp, Globe, Keyboard, Server, Sparkles, X } from "lucide-preact";
import { themeMode, veil } from "@/shared/theme/mode";
import { settingsOpen, settingsSection, updateState } from "@/app/state";
import {
  AgentIcon, Button, DataRow, Field, KbdGroup, Pill, SectionLabel, Segmented, SettingsDialog,
  SettingsHeading, Slider, Select, StatePill, Switch, Wordmark,
} from "@apex/ui";

const SECTIONS = [
  { id: "look", label: "Look", Icon: Sparkles },
  { id: "workspace", label: "Workspace", Icon: Globe },
  { id: "agents", label: "Agents", Icon: Bot },
  { id: "daemon", label: "Daemon", Icon: Server },
  { id: "shortcuts", label: "Shortcuts", Icon: Keyboard },
  { id: "about", label: "About", Icon: CircleHelp },
] as const;

export function SettingsModal({ inline, open = true, onClose }: { inline?: boolean; open?: boolean; onClose?: () => void } = {}) {
  return (
    <SettingsDialog
      open={open}
      modal={!inline}
      onClose={onClose ?? (() => settingsOpen.value = false)}
      sections={SECTIONS.map(({ id, label, Icon }) => ({ id, label, icon: <Icon size={14} strokeWidth={1.75} /> }))}
      section={settingsSection.value}
      onSection={(id) => settingsSection.value = id}
      close={<Button variant="subtle" size="lg" iconOnly title="Close" onClick={onClose ?? (() => settingsOpen.value = false)}><X size={13} /></Button>}
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
    <div>
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
    <div>
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
  const [off, setOff] = useState<string[]>([]);
  return (
    <div>
      <SettingsHeading title="Agents" sub="Rendering belongs to each agent: native when it speaks ACP, terminal otherwise." />
      {AGENTS.map((a) => {
        const enabled = !off.includes(a.id);
        return (
          <DataRow
            key={a.id}
            label={a.name}
            sub={a.ver}
            dim={!enabled}
            lead={<AgentIcon agent={a.id} size="sm" />}
            trail={
              <>
                {a.shares ? <Pill tone="accent" title="Shares your project context">shares context</Pill> : null}
                <Segmented
                  label={`${a.name} rendering`}
                  options={[{ value: "tty", label: "Terminal" }, { value: "acp", label: "Native" }]}
                  value={a.mode}
                  disabled={!enabled}
                  onChange={() => {}}
                />
              </>
            }
            actions={
              <Switch
                label={`Enable ${a.name}`}
                checked={enabled}
                onChange={(v) => setOff(v ? off.filter((x) => x !== a.id) : [...off, a.id])}
              />
            }
          />
        );
      })}
    </div>
  );
}

function DaemonSection() {
  return (
    <div>
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
    <div>
      <SettingsHeading title="Keyboard shortcuts" sub="Everything reachable without the mouse." />
      {SHORTCUTS.map(({ group, rows }) => (
        <div key={group}>
          <SectionLabel flush>{group}</SectionLabel>
          {rows.map(([label, keys]) => (
            <DataRow key={label} label={label} trail={<KbdGroup keys={keys} />} />
          ))}
        </div>
      ))}
    </div>
  );
}

const FACTS: [string, string][] = [
  ["apexd", "0.5.0"],
  ["Agent files", "~/.apex/agents"],
  ["Config", "~/.apex/config.toml"],
];

function AboutSection() {
  const checking = updateState.value === "Checking…";
  return (
    <div>
      <SettingsHeading title="About" sub="What is running on this machine." />

      <div class="about-card">
        <img class="about-icon" src="/brand/apex-icon.svg" alt="" width="44" height="44" />
        <div class="about-id">
          <div class="about-name">
            <Wordmark size="sm">APEX</Wordmark>
            <span class="about-product">Desktop</span>
          </div>
          <div class="about-meta mono">v0.5.0 · Tauri 2</div>
          <StatePill state="done" class="about-daemon">daemon connected</StatePill>
        </div>
        <div class="about-action">
          <Button
            disabled={checking}
            onClick={() => {
              updateState.value = "Checking…";
              setTimeout(() => (updateState.value = "You are up to date · just now"), 1200);
            }}
          >
            {checking ? "Checking…" : "Check updates"}
          </Button>
          <span class="about-update">{updateState.value}</span>
        </div>
      </div>

      <div>
        {FACTS.map(([label, value]) => (
          <DataRow key={label} label={label} trail={<span class="mono">{value}</span>} />
        ))}
      </div>
    </div>
  );
}
