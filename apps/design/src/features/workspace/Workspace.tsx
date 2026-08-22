import { useEffect, useState } from "preact/hooks";
import {
  ArrowLeftRight, Check, ChevronRight, FileText, GitBranch, Globe, Image as ImageIcon, Lock,
  Plus, RotateCw, Search, Send, Settings, X,
} from "lucide-preact";
import {
  activeTab, consoleOpen, fmode, launcherOpen,
  openPop, raceAsking, raceKept, removedProject,
  settingsOpen, toastCount, uaWindow,
} from "@/app/state";
import { SettingsModal } from "@/features/workspace/Settings";
import { ReviewPanel } from "@/features/dock/Panels";
import {
  AgentIcon, AppMain, Badge, BrowserLog, BrowserView, Modal, Bar, Button, Card, Chip, CodeLine, CodeView, Code, Composer,
  DiffFile, DiffHunk, DiffLine, DiffStat, DiffView, Dot, ImageView, MarkdownView, Pane, PaneGrid, PaneSplit,
  Pill, SectionLabel, Segmented, StatePill, Tab, TabBar, Toast, ToastStack, ToggleChip, ToggleChipGroup, Wordmark,
} from "@apex/ui";

function tone(pct: number) {
  if (pct >= 80) return "failed";
  if (pct >= 60) return "blocked";
  return "done";
}

const TABS = [
  { id: "tab-auth", title: "Refactor auth middleware" },
  { id: "tab-browser", title: "localhost:5173", icon: Globe },
  { id: "tab-race", title: "Race · dock resize jank", icon: ArrowLeftRight },
  { id: "tab-file", title: "README.md", icon: FileText },
  { id: "tab-code", title: "DockResize.ts", icon: FileText },
  { id: "tab-diff", title: "± DockResize.tsx", icon: GitBranch },
];

export function Workspace() {
  useEffect(() => {
    const t = setTimeout(() => toastCount.value = 0, 6500);
    return () => clearTimeout(t);
  }, []);

  return (
    <AppMain>
      <Sessions />
      <Overlays />
    </AppMain>
  );
}

const SUGGESTIONS = ["Refactor auth middleware", "Race a task across agents"];

function Home() {
  return (
    <div class="home">
      <div class="home-inner">
        <div class="home-mark">
          <Wordmark size="xl">APEX</Wordmark>
          <p class="home-tagline">Run a team of AI agents, not a wall of terminals.</p>
        </div>
        <Composer
          label="Task"
          placeholder="Ask, delegate, or start a task…"
          onSubmit={(e) => { e.preventDefault(); activeTab.value = "tab-auth"; }}
          lead={
            <ToggleChipGroup label="Agents">
              <ToggleChip pressed lead={<AgentIcon agent="claude" size="sm" />}>claude</ToggleChip>
              <ToggleChip pressed={false} lead={<AgentIcon agent="codex" size="sm" />}>codex</ToggleChip>
              <ToggleChip pressed={false} lead={<AgentIcon agent="grok" size="sm" />}>grok</ToggleChip>
            </ToggleChipGroup>
          }
          actions={<Button type="submit" variant="primary"><Send size={13} />Start</Button>}
        />
        <div class="home-suggestions">
          {SUGGESTIONS.map((t) => <Button key={t} size="sm" class="rounded-full">{t}</Button>)}
        </div>
      </div>
    </div>
  );
}

function Sessions() {
  return (
    <section class="view">
      <TabBar label="Sessions" addLabel="New session in a new tab" addIcon={<Plus size={14} />} onAdd={() => activeTab.value = "home"}>
        {TABS.map((t) => (
          <Tab
            key={t.id}
            title={t.title}
            selected={activeTab.value === t.id}
            lead={t.icon ? <t.icon size={13} style="color:var(--apex-muted);flex:none" /> : <AgentIcon agent="claude" size="sm" />}
            onClick={() => activeTab.value = t.id}
          />
        ))}
      </TabBar>

      <PaneGrid>
        {ALL_VIEWS.filter((v) => v.id === activeTab.value).map((v) => <v.Component key={v.id} />)}
      </PaneGrid>
    </section>
  );
}

export const WORKSPACE_VIEWS = [
  { id: "home", label: "Home", Component: Home },
];

export const PANE_TYPES = [
  { id: "tab-auth", label: "Session · split", Component: () => <AuthSplit /> },
  { id: "tab-acp", label: "Session · native", Component: () => <AcpPane /> },
  { id: "tab-tty", label: "Session · terminal", Component: () => <TerminalSessionPane /> },
  { id: "tab-browser", label: "Web preview", Component: () => <BrowserPane /> },
  { id: "tab-race", label: "Race", Component: () => <RacePane /> },
  { id: "tab-file", label: "Markdown", Component: () => <MarkdownPane /> },
  { id: "tab-code", label: "Code", Component: () => <CodePane /> },
  { id: "tab-diff", label: "Diff", Component: () => <DiffPane /> },
  { id: "tab-image", label: "Image", Component: () => <ImagePane /> },
  { id: "tab-panel", label: "Panel in a tab", Component: () => <PanelTabPane /> },
];

export const ALL_VIEWS = [...WORKSPACE_VIEWS, ...PANE_TYPES];

function AcpPane() {
  return (
      <Pane
        title="Refactor auth middleware"
        sub={<><Chip>⎇ apex/claude</Chip><span class="mono">2m 14s</span></>}
        lead={<AgentIcon agent="claude" />}
        actions={<StatePill state="blocked">Waiting</StatePill>}
        scroll={false}
        foot={
          <div class="reply-bar">
            <div class="reply-box">
              <input placeholder="Reply to claude…" aria-label="Reply to claude" />
              <button class="reply-send" aria-label="Send"><Send size={13} /></button>
            </div>
          </div>
        }
      >
        <div class="transcript">
          <div class="msg-user">Refactor auth middleware to use passkeys instead of session cookies.</div>
          <div class="tool">
            <div class="tool-head">
              <ChevronRight size={11} style="rotate:90deg;color:var(--apex-muted)" />
              <span class="tool-cmd">bash bun test tests/auth.test.ts</span>
              <span class="tool-meta"><span class="ok">✓ 2.3s</span></span>
            </div>
          </div>
          <div class="perm-card">
            <div class="perm-head"><Lock size={14} />Run a migration on the dev database?</div>
            <div class="perm-desc">bun run db:migrate --name passkeys</div>
            <div class="perm-actions">
              <Button variant="primary">Yes, run it</Button>
              <Button variant="danger">Deny</Button>
            </div>
          </div>
        </div>
      </Pane>
  );
}

function TerminalSessionPane() {
  return (
    <Pane
      title="Fix flaky checkout tests"
      sub={<><Chip>⎇ apex/codex</Chip><span class="mono">14m</span></>}
      lead={<AgentIcon agent="codex" />}
      actions={<StatePill state="working">Running</StatePill>}
      scroll={false}
    >
      <img class="pane-mock" data-mock="tty" src="/mock/tty.svg" alt="Terminal session rendered by xterm" />
    </Pane>
  );
}

function AuthSplit() {
  return (
    <PaneSplit>
      <AcpPane />
      <TerminalSessionPane />
    </PaneSplit>
  );
}

function ImagePane() {
  return (
    <Pane
      lead={<ImageIcon size={12} style="color:var(--apex-muted)" />}
      title="assets/brand/welcome.png"
      actions={<Chip>PNG</Chip>}
      scroll={false}
    >
      <ImageView
        src="/mock/browser.svg"
        alt="welcome.png"
        meta="520 × 340 · 48 KB"
        actions={<Chip tone="accent">fit</Chip>}
      />
    </Pane>
  );
}

function PanelTabPane() {
  return (
    <Pane
      lead={<ArrowLeftRight size={12} style="color:var(--apex-muted)" />}
      title="Review"
      actions={<Button variant="subtle" size="sm">Move to sidebar</Button>}
    >
      <ReviewPanel />
    </Pane>
  );
}

function BrowserPane() {
  return (
    <Pane scroll={false}>
      <BrowserView
        url="localhost:5173/login"
        secure={<Lock size={11} style="color:var(--apex-state-done)" />}
        consoleOpen={consoleOpen.value}
        lead={<Button variant="subtle" size="sm" iconOnly title="Reload"><RotateCw size={13} /></Button>}
        actions={
          <Button variant="subtle" size="sm" iconOnly title="Console" onClick={() => consoleOpen.value = !consoleOpen.value}>
            <Search size={13} /><Badge tone="removed">2</Badge>
          </Button>
        }
        consoleActions={<Button variant="subtle" size="xs">Clear</Button>}
        console={
          <>
            <BrowserLog level="error">[auth] Failed to verify legacy cookie: invalid signature</BrowserLog>
            <BrowserLog level="warn">[webauthn] Challenge expired after 120s, retrying</BrowserLog>
            <BrowserLog level="info">[vite] hmr update /src/auth/passkey.ts</BrowserLog>
          </>
        }
      >
        <img class="pane-mock" data-mock="browser" src="/mock/browser.svg" alt="Web preview rendered by the native webview" />
      </BrowserView>
    </Pane>
  );
}

function RacePane() {
  const kept = raceKept.value;
  return (
    <Pane scroll={false}>
      <div class="race-view">
        <p class="race-task">Fix the dock resize jank</p>
        <div class="race-cols">
          <div class={`race-col${kept ? "" : ""}`} style={kept ? undefined : undefined}>
            <div class="race-col-head">
              <AgentIcon agent="claude" size="sm" /><span class="c-name">claude</span>
              {kept && <span class="dropped-tag" style="color:var(--apex-state-done);border-color:color-mix(in oklab, var(--apex-state-done) 40%, transparent)">kept</span>}
              {!kept && <Dot state="done" />}
            </div>
            <p class="diff-line-plain">14 files <DiffStat added={382} removed={96} /></p>
          </div>
          <div class={`race-col${kept ? " dropped" : ""}`}>
            <div class="race-col-head">
              <AgentIcon agent="codex" size="sm" /><span class="c-name">codex</span>
              {!kept && <Dot state="working" />}
            </div>
            <p class="c-note">{kept ? "Dropped." : "Still working…"}</p>
          </div>
          <div class="race-col dropped">
            <div class="race-col-head"><AgentIcon agent="antigravity" size="sm" /><span class="c-name">antigravity</span><span class="dropped-tag">dropped</span></div>
            <p class="c-note">Left nothing behind.</p>
          </div>
        </div>
        {!kept && (
          <div class="race-decide">
            <span class="rd-info">
              {raceAsking.value
                ? "Keep claude's work and drop codex's worktree?"
                : <><b>claude</b> finished first · tests 48 ✓ · 14 files · waiting on you</>}
            </span>
            <Button onClick={() => raceAsking.value = false}>Wait for codex</Button>
            <Button variant="primary" onClick={() => raceAsking.value ? raceKept.value = true : raceAsking.value = true}>
              {raceAsking.value ? "Yes, keep claude" : "Keep claude's work"}
            </Button>
          </div>
        )}
      </div>
    </Pane>
  );
}

function MarkdownPane() {
  const view = fmode.value;
  return (
    <Pane
      lead={<FileText size={12} style="color:var(--apex-muted)" />}
      title="docs/README.md"
      actions={
        <>
        <Chip>markdown</Chip>
        <Segmented
          label="File view"
          options={[{ value: "preview", label: "Preview" }, { value: "source", label: "Source" }]}
          value={view}
          onChange={(v) => fmode.value = v as "preview" | "source"}
        />
        </>
      }
    >
        {view === "preview" ? (
          <MarkdownView>
            <h1>Apex</h1>
            <p>Run a team of AI agents, not a wall of terminals.</p>
            <h2>Install</h2>
            <pre>curl -fsSL https://apex.dev/install.sh | sh</pre>
            <h2>What you get</h2>
            <ul>
              <li><strong>Sessions</strong>: terminal or native rendering per agent</li>
              <li><strong>Races</strong>: fan one task across agents, keep the winner</li>
            </ul>
          </MarkdownView>
        ) : (
          <CodeView>
            <CodeLine number={1}><Code token="comment"># Apex</Code></CodeLine>
            <CodeLine number={2} />
            <CodeLine number={3}>Run a team of AI agents.</CodeLine>
            <CodeLine number={5}><Code token="comment">## Install</Code></CodeLine>
            <CodeLine number={7}>    curl -fsSL https://apex.dev/install.sh | sh</CodeLine>
          </CodeView>
        )}
    </Pane>
  );
}

function CodePane() {
  return (
    <Pane
      lead={<FileText size={12} style="color:var(--apex-muted)" />}
      title="src/dock/DockResize.ts"
      actions={<Chip>typescript</Chip>}
    >
      <CodeView>
        <CodeLine number={1}><Code token="comment">// clamp the dock between the rail and half the window</Code></CodeLine>
        <CodeLine number={2}><Code token="keyword">export function</Code>{" "}<Code token="function">clamp</Code>(x: number, rail: number, max: number) {"{"}</CodeLine>
        <CodeLine number={3}>  <Code token="keyword">return</Code> Math.<Code token="function">min</Code>(Math.<Code token="function">max</Code>(x, rail), max);</CodeLine>
        <CodeLine number={4}>{"}"}</CodeLine>
        <CodeLine number={5} />
        <CodeLine number={6}><Code token="keyword">export const</Code> STORAGE_KEY = <Code token="string">"apex.dock.width"</Code>;</CodeLine>
      </CodeView>
    </Pane>
  );
}

function DiffPane() {
  return (
    <Pane
      lead={<GitBranch size={12} style="color:var(--apex-muted)" />}
      title="apex/claude · DockResize.tsx"
      actions={<><Chip>staged</Chip><span class="mono text-xs">2 / 4</span></>}
    >
      <DiffView>
        <DiffFile path="apps/desktop/…/DockResize.tsx" added={24} removed={11}>
          <DiffHunk range="@@ -12,7 +12,9 @@" actions={<Button size="xs" variant="ghost">Stage hunk</Button>} />
          <DiffLine kind="ctx">{"  const onPointer = (event) => {"}</DiffLine>
          <DiffLine kind="del">{"-    setWidth(event.clientX - origin);"}</DiffLine>
          <DiffLine kind="add">{"+    const next = clamp(event.clientX - origin, rail, max);"}</DiffLine>
          <DiffLine kind="ctx">{"  };"}</DiffLine>
        </DiffFile>
      </DiffView>
    </Pane>
  );
}

function Overlays() {
  return (
    <>
      {toastCount.value > 0 && (
        <ToastStack>
          <Toast
            title="Codex finished"
            detail="Fix the race settle flow · exit 0"
            tone="done"
            duration={6500}
            lead={<AgentIcon agent="codex" size="sm" />}
            onDismiss={() => toastCount.value = 0}
          />
        </ToastStack>
      )}

      {openPop.value === "usage" && <UsagePop />}
      {openPop.value === "resources" && <ResourcesPop />}
      {openPop.value === "notifications" && <NotificationsPop />}
      {openPop.value === "target" && <TargetPop />}
      {openPop.value === "projects" && <ProjectsPop />}
      {launcherOpen.value && <Launcher />}
      {settingsOpen.value && <SettingsModal />}
    </>
  );
}

function Pop({ title, meta, actions, children }: { title: string; meta?: string; actions?: any; children: any }) {
  return (
    <div class="popover" onClick={(e) => e.stopPropagation()}>
      <div class="pop-head">
        {title}
        <span style="flex:1" />
        {meta ? <span class="pop-fresh">{meta}</span> : null}
        {actions}
        <Button variant="subtle" size="xs" iconOnly aria-label="Close" onClick={() => openPop.value = null}><X size={12} /></Button>
      </div>
      {children}
    </div>
  );
}

export function UsagePop() {
  const [grokFailed, setGrokFailed] = useState(true);
  const pct = uaWindow.value === "5h" ? 62 : 34;
  return (
    <Pop
      title="claude · usage"
      meta="updated 2m ago"
      actions={<Button variant="subtle" size="xs" iconOnly aria-label="Refresh" title="Refresh"><RotateCw size={11} /></Button>}
    >
      <div class="ua-window" role="group">
        <button aria-pressed={uaWindow.value === "5h"} onClick={() => uaWindow.value = "5h"}>5h</button>
        <button aria-pressed={uaWindow.value === "7d"} onClick={() => uaWindow.value = "7d"}>7d</button>
      </div>
      <div class="ua-big">
        <span class="n" data-tone={tone(pct)}>{pct}%</span>
        <span style="font-size:11px;color:var(--apex-muted)">resets in 2h 30m · Tue 4:00</span>
      </div>
      <div class="u-row"><span class="u-win">used</span><Bar value={pct} tick={58} size="sm" label="used" /><span class="u-eta">pace ✓</span></div>
      <div class="u-row"><span class="u-win">7d</span><Bar value={34} tone="done" size="sm" label="7 day usage" /><span class="u-eta">on pace</span></div>

      <div class="pop-head pop-sub">
        codex
        <span class="ph-sub" data-tone={tone(71)}>71% · over pace</span>
      </div>
      <div class="u-row"><span class="u-win">5h</span><Bar value={71} tone="blocked" size="sm" label="codex usage" /><span class="u-eta">tight</span></div>

      {grokFailed ? (
        <div class="pop-fail">
          <AgentIcon agent="grok" size="sm" />
          <span style="flex:1">grok quota unavailable</span>
          <Button variant="subtle" size="xs" onClick={() => setGrokFailed(false)}>Retry</Button>
        </div>
      ) : (
        <>
          <div class="pop-head pop-sub">
            grok
            <span class="ph-sub" data-tone={tone(12)}>12% · plenty left</span>
          </div>
          <div class="u-row"><span class="u-win">5h</span><Bar value={12} tone="done" size="sm" label="grok usage" /><span class="u-eta">easy</span></div>
        </>
      )}
    </Pop>
  );
}

const SESSIONS = [
  {
    id: "auth",
    name: "Refactor auth middleware",
    agent: "claude",
    state: "working" as const,
    mem: "520 MB",
    pct: "14%",
    procs: [
      { pid: 4821, cmd: "claude", mem: "412 MB", agent: true },
      { pid: 4933, cmd: "bun test tests/auth.test.ts", mem: "96 MB", agent: false },
    ],
  },
  {
    id: "checkout",
    name: "Fix flaky checkout tests",
    agent: "codex",
    state: "done" as const,
    mem: "362 MB",
    pct: "2%",
    procs: [{ pid: 3987, cmd: "codex", mem: "288 MB", agent: true }],
  },
];

function ProcRow({ proc, onKill }: { proc: typeof SESSIONS[0]["procs"][0]; onKill: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div class="proc-confirm">
        <span>End this session? The agent stops, the worktree stays.</span>
        <span class="proc-confirm-actions">
          <Button variant="subtle" size="xs" onClick={() => setConfirming(false)}>Cancel</Button>
          <Button variant="danger" size="xs" onClick={onKill}>End session</Button>
        </span>
      </div>
    );
  }

  return (
    <div class="proc-row">
      <span class="proc-cmd mono">{proc.cmd}</span>
      <span class="proc-pid mono">{proc.pid}</span>
      <span class="proc-mem mono">{proc.mem}</span>
      <Button
        class="proc-kill"
        variant="subtle"
        size="xs"
        iconOnly
        title={proc.agent ? `End the session running ${proc.cmd}` : `Kill ${proc.cmd} (${proc.pid})`}
        aria-label={proc.agent ? `End the session running ${proc.cmd}` : `Kill ${proc.cmd} (${proc.pid})`}
        onClick={() => proc.agent ? setConfirming(true) : onKill()}
      >
        <X size={11} />
      </Button>
    </div>
  );
}

export function ResourcesPop() {
  const [killed, setKilled] = useState<number[]>([]);
  const live = SESSIONS.map((s) => ({ ...s, procs: s.procs.filter((p) => !killed.includes(p.pid)) }))
    .filter((s) => s.procs.length > 0);

  return (
    <Pop title="Resources" meta="sampled every 5s">
      <div class="pop-head" style="margin-top:2px;padding:0">CPU<span class="ph-sub mono" style="color:var(--apex-text)">23%</span><span class="ph-sub mono">14 cores · user 18% sys 5%</span></div>
      <svg class="spark" viewBox="0 0 300 54" preserveAspectRatio="none">
        <path d="M0 40 C 20 38, 30 34, 45 35 S 70 28, 85 30 S 110 22, 125 26 S 150 30, 165 24 S 190 18, 205 22 S 230 28, 245 20 S 270 14, 285 18 L 300 16 L 300 54 L 0 54 Z" fill="var(--apex-accent)" opacity="0.14" />
        <path d="M0 40 C 20 38, 30 34, 45 35 S 70 28, 85 30 S 110 22, 125 26 S 150 30, 165 24 S 190 18, 205 22 S 230 28, 245 20 S 270 14, 285 18 L 300 16" fill="none" stroke="var(--apex-accent)" stroke-width="1.6" />
      </svg>
      <div class="meter"><span class="m-label">Memory</span><Bar value={56} label="Memory" /><span class="m-pct mono">56%</span><span class="m-detail">18.2/32 GB</span></div>
      <div class="meter"><span class="m-label">Swap</span><Bar value={6} tone="done" label="Swap" /><span class="m-pct mono">6%</span><span class="m-detail">0.18/3 GB</span></div>
      <div class="meter"><span class="m-label">Apex</span><Bar value={12} tone="done" label="Apex memory" /><span class="m-pct mono">12%</span><span class="m-detail">312 MB</span></div>

      <SectionLabel class="pop-total" count="882 MB · 16%">Sessions and processes</SectionLabel>
      {live.length === 0 ? (
        <div class="proc-empty">Nothing running.</div>
      ) : live.map((s) => (
        <div class="proc-group" key={s.id}>
          <div class="sess-res-row">
            <Dot state={s.state} />
            <span style="flex:1;min-width:0">{s.name}</span>
            <span class="mono" style="font-size:10.5px;color:var(--apex-muted)">{s.mem} · {s.pct}</span>
          </div>
          {s.procs.map((p) => (
            <ProcRow
              key={p.pid}
              proc={p}
              onKill={() => setKilled((k) => [...k, ...(p.agent ? s.procs.map((x) => x.pid) : [p.pid])])}
            />
          ))}
        </div>
      ))}
    </Pop>
  );
}

export function NotificationsPop() {
  const notices = [
    ["blocked", "Waiting for your approval", "antigravity wants to run a migration", "2m"],
    ["done", "Codex finished", "Fix the race settle flow · exit 0", "14m"],
    ["failed", "Weekly quota almost gone", "claude · 71% used, over pace", "1h"],
  ];
  return (
    <Pop title="Notifications">
      {notices.map(([state, title, body, age]) => (
        <button class="notice-row" key={title}>
          <Dot state={state as "blocked" | "done" | "failed"} />
          <div style="flex:1;min-width:0">
            <div style="font-size:12.5px">{title}</div>
            <div style="font-size:11px;color:var(--apex-muted)">{body}</div>
          </div>
          <span style="font-size:10.5px;color:var(--apex-muted)">{age}</span>
        </button>
      ))}
    </Pop>
  );
}

export function TargetPop() {
  return (
    <Pop title="Where git commands run">
      <button class="tgt-row"><span style="color:var(--apex-accent)"><Check size={13} /></span>
        <span class="tgt-name"><span class="t1">apex-sandbox <Chip class="h-4 text-2xs">project</Chip></span><span class="t2">main · 16 changed</span></span>
      </button>
      <div class="pl-label" style="padding-left:0">Worktrees · 2 live</div>
      <button class="tgt-row"><Dot state="working" /><span class="tgt-name"><span class="t1">Refactor auth middleware</span><span class="t2">apex/claude · 3 changed</span></span></button>
      <button class="tgt-row"><Dot state="working" /><span class="tgt-name"><span class="t1">Fix flaky checkout tests</span><span class="t2">apex/codex · 5 changed</span></span></button>
      <div class="pl-label" style="padding-left:0">Branches</div>
      <button class="tgt-row"><span class="t1" style="color:var(--apex-muted)">release</span><span class="t2">behind 4</span></button>
    </Pop>
  );
}

export function ProjectsPop() {
  return (
    <div class="popover" style="left:10px;right:auto;width:264px" onClick={(e) => e.stopPropagation()}>
      <div class="pop-head">Projects<span style="flex:1" /><button onClick={() => openPop.value = null}><X size={12} /></button></div>
      <button class="notice-row"><span class="proj-glyph" style="width:22px;height:22px"><Check size={11} /></span>
        <div style="flex:1;min-width:0"><div style="font-size:12.5px">apex-sandbox</div><div style="font-size:11px;color:var(--apex-muted)" class="mono">~/Documents/Codes/apex-sandbox</div></div>
        <Pill tone="accent" class="h-[18px] text-2xs">2 running</Pill>
      </button>
      {!removedProject.value && (
        <button class="notice-row"><span class="proj-glyph" style="width:22px;height:22px"><FileText size={11} /></span>
          <div style="flex:1;min-width:0"><div style="font-size:12.5px">apex-docs</div><div style="font-size:11px;color:var(--apex-muted)" class="mono">~/Documents/Codes/apex-docs</div></div>
          <Pill tone="blocked" class="h-[18px] text-2xs">1 waiting</Pill>
          <button class="rev-act" style="width:22px;height:22px" title="Remove from Apex" onClick={(e) => { e.stopPropagation(); removedProject.value = true; }}><X size={11} /></button>
        </button>
      )}
      {removedProject.value && <div style="font-size:12px;color:var(--apex-state-done);padding:6px 8px">Removed apex-docs</div>}
      <button class="notice-row"><span class="proj-glyph" style="width:22px;height:22px"><Plus size={11} /></span><div style="font-size:12.5px">Open project…</div></button>
    </div>
  );
}

export function Launcher({ inline, open = true, onClose }: { inline?: boolean; open?: boolean; onClose?: () => void } = {}) {
  const [picked, setPicked] = useState<string[]>(["claude", "codex"]);
  return (
    <Modal
      open={open}
      modal={!inline}
      onClose={onClose ?? (() => launcherOpen.value = false)}
      title="Race a task"
      actions={<Button variant="subtle" size="sm" iconOnly title="Close" onClick={onClose ?? (() => launcherOpen.value = false)}><X size={13} /></Button>}
    >
        <div>
          <div class="set-sub">Every contender gets the same task and its own worktree. You keep the winner.</div>
          <textarea class="commit-msg" style="min-height:64px">Fix the dock resize jank</textarea>
          <div class="pl-label" style="padding-left:0">Who runs it</div>
          <ToggleChipGroup label="Contenders">
            {["claude", "codex", "grok", "opencode"].map((a) => (
              <ToggleChip key={a} pressed={picked.includes(a)}
                lead={<AgentIcon agent={a} size="sm" />}
                trail={picked.includes(a) ? <Check size={11} /> : undefined}
                onClick={() => setPicked(picked.includes(a) ? picked.filter((x) => x !== a) : [...picked, a])}>
                {a}
              </ToggleChip>
            ))}
          </ToggleChipGroup>
          <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
            <span style="font-size:11.5px;color:var(--apex-muted);flex:1">
              {picked.length < 2 ? "Pick at least two." : `${picked.length} agents · one worktree each · no prompts`}
            </span>
            <Button variant="primary" disabled={picked.length < 2}
              onClick={() => { launcherOpen.value = false; activeTab.value = "tab-race"; }}>
              Start race
            </Button>
          </div>
        </div>
    </Modal>
  );
}
