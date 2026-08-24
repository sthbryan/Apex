import { useEffect, useState } from "preact/hooks";
import {
  ArrowLeft, ArrowLeftRight, ArrowRight, Check, Columns3, FileText, GitBranch, Globe,
  Image as ImageIcon, Lock, PanelLeft, Plus, RotateCw, Search, Send, Terminal, X,
} from "lucide-preact";
import {
  activePanel, activeTab, consoleOpen, dlayout, fmode, ifit, launcherOpen, paletteOpen,
  raceAsking, raceKept, railOnly, settingsOpen, toastCount,
} from "@/app/state";
import { SettingsModal } from "@/features/workspace/Settings";
import { CONTENDERS, RACE_PROMPT, REVIEWS, SESSIONS } from "@/features/dock/fixtures";
import { ReviewPanel } from "@/features/dock/Panels";
import {
  AgentIcon, AppMain, ApprovalCard, Badge, BrowserLog, BrowserView, CommandItem, CommandPalette, Modal,
  BrowserUrl, Button, Chip, CodeLine, CodeView, Code, Composer, DiffFile, DiffHunk, DiffLine, DiffStat, DiffView, Dot,
  ImageView, Kbd, KbdGroup, MarkdownView, Message,
  ListRow, Pane, PaneGrid, PaneSplit, RaceColumn, RaceDecision, RaceView, SectionLabel, Segmented,
  StatePill, Tab, TabBar, Toast, ToastStack, ToggleChip, ToggleChipGroup, ToolCall, Transcript,
  Welcome, Wordmark,
} from "@apex/ui";

const TABS = [
  { id: "tab-auth", title: "Refactor auth middleware" },
  { id: "tab-browser", title: "localhost:5173", icon: Globe },
  { id: "tab-race", title: "Race · dock resize jank", icon: ArrowLeftRight },
  { id: "tab-layout", title: "Ship passkeys", icon: Columns3 },
  { id: "tab-file", title: "README.md", icon: FileText },
  { id: "tab-code", title: "DockResize.ts", icon: FileText },
  { id: "tab-diff", title: "± DockResize.tsx", icon: GitBranch },
];

export function Workspace() {
  useEffect(() => {
    const t = setTimeout(() => toastCount.value = 0, 6500);
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === "k") { e.preventDefault(); paletteOpen.value = !paletteOpen.value; }
      if (e.key === "b") { e.preventDefault(); railOnly.value = !railOnly.value; }
      if (e.key === ",") { e.preventDefault(); settingsOpen.value = true; }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKeyDown); };
  }, []);

  return (
    <AppMain>
      <Sessions />
      <Overlays />
    </AppMain>
  );
}

const SUGGESTIONS = ["Refactor auth middleware", "Race a task across agents"];

function HomeSummary() {
  const blocked = SESSIONS.filter((s) => s.state === "blocked");
  const running = SESSIONS.filter((s) => s.state === "working");
  return (
    <div class="home-summary">
      <div>
        <SectionLabel flush count={blocked.length + REVIEWS.length}>Waiting on you</SectionLabel>
        {blocked.map((s) => (
          <ListRow
            key={s.id}
            label={s.name}
            sub={s.activity}
            lead={<Dot state={s.state} />}
            trail={<span class="mono">{s.elapsed}</span>}
            onClick={() => activeTab.value = s.tab}
          />
        ))}
        {REVIEWS.map((r) => (
          <ListRow
            key={r.id}
            label={r.title}
            sub={<>{r.branch} · {r.files} files<DiffStat added={r.added} removed={r.removed} /></>}
            lead={<AgentIcon agent={r.agent} size="sm" />}
            trail={<span>review</span>}
            onClick={() => activePanel.value = "review"}
          />
        ))}
      </div>
      <div>
        <SectionLabel flush count={running.length + 1}>Running</SectionLabel>
        {running.map((s) => (
          <ListRow
            key={s.id}
            label={s.name}
            sub={s.activity}
            lead={<Dot state={s.state} />}
            trail={<span class="mono">{s.elapsed}</span>}
            onClick={() => activeTab.value = s.tab}
          />
        ))}
        <ListRow
          label={`Race · ${RACE_PROMPT}`}
          sub={`${CONTENDERS.filter((c) => !c.dropped).length} contenders`}
          lead={<Dot state="working" />}
          trail={<span class="mono">4m</span>}
          onClick={() => activeTab.value = "tab-race"}
        />
      </div>
    </div>
  );
}

const HOME_AGENTS = ["antigravity", "claude", "codex", "githubcopilot", "grok", "opencode", "pi"];

function Home() {
  const [picked, setPicked] = useState<string[]>(["claude"]);
  const [racing, setRacing] = useState(false);
  const [isolate, setIsolate] = useState(false);
  const pick = (name: string) => setPicked((current) =>
    racing
      ? current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
      : [name]);

  return (
    <Welcome
      mark={<Wordmark size="xl">APEX</Wordmark>}
      tagline="Run a team of AI agents, not a wall of terminals."
      suggestions={SUGGESTIONS.map((t) => <Button key={t} size="sm" class="rounded-full">{t}</Button>)}
      foot={<HomeSummary />}
    >
      <Composer
        label="Task"
        placeholder="Ask, delegate, or start a task…"
        onSubmit={(e) => { e.preventDefault(); activeTab.value = "tab-auth"; }}
        lead={
          <>
            <ToggleChipGroup label="Agents">
              {HOME_AGENTS.map((name) => {
                const on = picked.includes(name);
                return (
                  <ToggleChip
                    key={name}
                    pressed={on}
                    iconOnly={!on}
                    title={name}
                    lead={<AgentIcon agent={name} size="sm" />}
                    onClick={() => pick(name)}
                  >
                    {on ? name : null}
                  </ToggleChip>
                );
              })}
            </ToggleChipGroup>
            <span class="mx-0.5 h-5 w-px flex-none" style="background:var(--apex-border)" />
            <ToggleChip
              pressed={racing}
              title="Run the task across every agent you pick"
              lead={<ArrowLeftRight size={13} />}
              onClick={() => { setRacing(!racing); if (racing) setPicked((c) => c.slice(0, 1)); }}
            >
              Race
            </ToggleChip>
            {!racing && (
              <ToggleChip
                pressed={isolate}
                title="Its own branch and folder, so agents never collide"
                lead={<GitBranch size={13} />}
                onClick={() => setIsolate(!isolate)}
              >
                Worktree
              </ToggleChip>
            )}
          </>
        }
        actions={
          <Button type="submit" variant="primary">
            <Send size={13} />{racing ? "Race" : "Start"}
          </Button>
        }
      />
    </Welcome>
  );
}

function Sessions() {
  return (
    <>
      <TabBar label="Sessions" addLabel="New session in a new tab" addIcon={<Plus size={14} />} onAdd={() => activeTab.value = "home"}>
        {TABS.map((t) => (
          <Tab
            key={t.id}
            title={t.title}
            selected={activeTab.value === t.id}
            lead={t.icon ? <t.icon size={13} style="color:var(--apex-muted);flex:none" /> : <AgentIcon agent="claude" size="sm" />}
            onOpen={() => activeTab.value = t.id}
          />
        ))}
      </TabBar>

      <PaneGrid>
        {ALL_VIEWS.filter((v) => v.id === activeTab.value).map((v) => <v.Component key={v.id} />)}
      </PaneGrid>
    </>
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
  { id: "tab-layout", label: "Layout · five panes", Component: () => <FivePaneLayout /> },
  { id: "tab-file", label: "Markdown", Component: () => <MarkdownPane /> },
  { id: "tab-code", label: "Code", Component: () => <CodePane /> },
  { id: "tab-diff", label: "Diff", Component: () => <DiffPane /> },
  { id: "tab-image", label: "Image", Component: () => <ImagePane /> },
  { id: "tab-panel", label: "Panel in a tab", Component: () => <PanelTabPane /> },
];

export const ALL_VIEWS = [...WORKSPACE_VIEWS, ...PANE_TYPES];

function PaneTools() {
  return (
    <>
      <Button variant="ghost" size="xs" iconOnly title="Split right"><Columns3 size={12} /></Button>
      <Button variant="ghost" size="xs" iconOnly title="Close pane"><X size={12} /></Button>
    </>
  );
}

function AcpPane() {
  const [openTool, setOpenTool] = useState<string | null>(null);
  return (
    <Pane
      title="Refactor auth middleware"
      sub={<><Chip>⎇ apex/claude</Chip><span class="mono">2m 14s</span><StatePill state="blocked">Waiting</StatePill></>}
      lead={<AgentIcon agent="claude" />}
      actions={<PaneTools />}
      scroll={false}
      foot={
        <Composer
          class="reply"
          label="Reply to claude"
          placeholder="Reply to claude…"
          rows={1}
          onSubmit={(e) => e.preventDefault()}
          actions={<Button type="submit" variant="primary" size="sm" iconOnly title="Send"><Send size={13} /></Button>}
        />
      }
    >
      <Transcript>
        <Message from="user">Refactor auth middleware to use passkeys instead of session cookies.</Message>
        <Message meta="claude">
          The middleware still reads a session cookie on every request, so passkeys need a challenge
          store first. Running the suite to see what depends on it.
        </Message>
        {TOOL_CALLS.map((t) => (
          <ToolCall
            key={t.command}
            name={t.name}
            command={t.command}
            status={t.status}
            detail={t.detail}
            open={openTool === t.command}
            onToggle={t.output ? () => setOpenTool(openTool === t.command ? null : t.command) : undefined}
          >
            {t.output}
          </ToolCall>
        ))}
        <ApprovalCard
          question="Run a migration on the dev database?"
          command="bun run db:migrate --name passkeys"
          meta="idle 2m"
          lead={<Lock size={14} />}
          approveLabel="Yes, run it"
        />
      </Transcript>
    </Pane>
  );
}

const TOOL_CALLS: { name: string; command: string; status?: "ok" | "failed" | "running"; detail: string; output?: string }[] = [
  { name: "read", command: "src/auth/middleware.ts", detail: "142 lines" },
  {
    name: "bash",
    command: "bun test tests/auth.test.ts",
    detail: "2.3s",
    output: "tests/auth.test.ts:\n  ✓ rejects an expired cookie\n  ✓ accepts a passkey assertion\n\n 2 pass, 0 fail",
  },
  { name: "bash", command: "bun run db:migrate --dry-run", status: "running", detail: "8s" },
];

function TerminalSessionPane() {
  return (
    <Pane
      title="Fix flaky checkout tests"
      sub={<><Chip>⎇ apex/codex</Chip><span class="mono">14m</span><StatePill state="working">Running</StatePill></>}
      lead={<AgentIcon agent="codex" />}
      actions={<PaneTools />}
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

function FivePaneLayout() {
  return (
    <PaneGrid min={200}>
      <AcpPane />
      <PaneSplit axis="col">
        <BrowserPane />
        <TerminalSessionPane />
      </PaneSplit>
      <PaneSplit axis="col">
        <DiffPane />
        <CodePane />
      </PaneSplit>
    </PaneGrid>
  );
}

function ImagePane() {
  return (
    <Pane
      lead={<ImageIcon size={12} style="color:var(--apex-muted)" />}
      title="welcome.png"
      sub={<><span>assets/brand</span><Chip>PNG</Chip><span class="mono">520 × 340 · 48 KB</span></>}
      controls={
        <Segmented
          label="Image fit"
          options={[{ value: "contain", label: "Fit" }, { value: "actual", label: "Actual" }]}
          value={ifit.value}
          onChange={(v) => ifit.value = v as "contain" | "actual"}
        />
      }
      actions={<PaneTools />}
      scroll={false}
    >
      <ImageView src="/mock/browser.svg" alt="welcome.png" fit={ifit.value} />
    </Pane>
  );
}

function PanelTabPane() {
  return (
    <Pane
      lead={<ArrowLeftRight size={12} style="color:var(--apex-muted)" />}
      title="Review"
      controls={<Button variant="ghost" size="xs" iconOnly title="Move to the sidebar"><PanelLeft size={12} /></Button>}
      actions={<PaneTools />}
    >
      <ReviewPanel />
    </Pane>
  );
}

function BrowserPane() {
  return (
    <Pane
      scroll={false}
      wide
      lead={
        <>
          <Button variant="ghost" size="xs" iconOnly title="Back" disabled><ArrowLeft size={13} /></Button>
          <Button variant="ghost" size="xs" iconOnly title="Forward" disabled><ArrowRight size={13} /></Button>
          <Button variant="ghost" size="xs" iconOnly title="Reload"><RotateCw size={12} /></Button>
        </>
      }
      title={<BrowserUrl url="localhost:5173/login" secure={<Lock size={11} style="color:var(--apex-state-done)" />} />}
      controls={
        <Button
          variant="ghost"
          size="xs"
          aria-pressed={consoleOpen.value}
          title="Console ⌥⌘J"
          onClick={() => consoleOpen.value = !consoleOpen.value}
        >
          <Terminal size={12} />Console<Badge tone="removed">2</Badge>
        </Button>
      }
      actions={<PaneTools />}
    >
      <BrowserView
        consoleOpen={consoleOpen.value}
        consoleActions={<Button variant="ghost" size="xs">Clear</Button>}
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
  const winner = CONTENDERS.find((c) => c.state === "done");
  const waiting = CONTENDERS.find((c) => c.state === "working");
  return (
    <Pane
      scroll={false}
      lead={<ArrowLeftRight size={12} style="color:var(--apex-muted)" />}
      title="Race"
      sub={<><span class="truncate">{RACE_PROMPT}</span><Chip>{CONTENDERS.length} contenders</Chip></>}
      actions={<PaneTools />}
    >
      <RaceView
        foot={kept || !winner ? undefined : (
          <RaceDecision
            info={raceAsking.value
              ? `Keep ${winner.agent}'s work and drop the other worktrees?`
              : <><b>{winner.agent}</b> finished first · tests {winner.tests} · {winner.files} files · waiting on you</>}
            actions={
              <>
                {waiting ? <Button onClick={() => raceAsking.value = false}>Wait for {waiting.agent}</Button> : null}
                <Button variant="primary"
                  onClick={() => raceAsking.value ? raceKept.value = true : raceAsking.value = true}>
                  {raceAsking.value ? `Yes, keep ${winner.agent}` : `Keep ${winner.agent}'s work`}
                </Button>
              </>
            }
          />
        )}
      >
        {CONTENDERS.map((c) => {
          const state = c.dropped || (kept && c.agent !== winner?.agent)
            ? "dropped"
            : kept ? "kept" : "running";
          return (
            <RaceColumn
              key={c.agent}
              name={c.agent}
              state={state}
              lead={<AgentIcon agent={c.agent} size="sm" />}
              trail={
                state === "kept" ? <Chip tone="done">kept</Chip>
                  : state === "dropped" ? <Chip>dropped</Chip>
                    : <Dot state={c.state} />
              }
            >
              {state === "dropped" && c.dropped
                ? c.note
                : c.state === "working" && !kept
                  ? c.note
                  : <p class="mono">{c.files} files <DiffStat added={c.added} removed={c.removed} /></p>}
            </RaceColumn>
          );
        })}
      </RaceView>
    </Pane>
  );
}

function MarkdownPane() {
  const view = fmode.value;
  return (
    <Pane
      lead={<FileText size={12} style="color:var(--apex-muted)" />}
      title="README.md"
      sub={<><span>docs</span><Chip>markdown</Chip></>}
      controls={
        <Segmented
          label="File view"
          options={[{ value: "preview", label: "Preview" }, { value: "source", label: "Source" }]}
          value={view}
          onChange={(v) => fmode.value = v as "preview" | "source"}
        />
      }
      actions={<><Button variant="ghost" size="xs" iconOnly title="Reload"><RotateCw size={12} /></Button><PaneTools /></>}
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
      title="DockResize.ts"
      sub={<><span>src/dock</span><Chip>typescript</Chip></>}
      actions={<><Button variant="ghost" size="xs" iconOnly title="Reload"><RotateCw size={12} /></Button><PaneTools /></>}
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
      title="DockResize.tsx"
      sub={<><span>apex/claude</span><Chip>staged</Chip><span class="mono">2 / 4</span></>}
      controls={
        <Segmented
          label="Diff layout"
          options={[{ value: "unified", label: "Unified" }, { value: "split", label: "Split" }]}
          value={dlayout.value}
          onChange={(v) => dlayout.value = v as "unified" | "split"}
        />
      }
      actions={<><Button variant="ghost" size="xs" iconOnly title="Reload"><RotateCw size={12} /></Button><PaneTools /></>}
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

      {paletteOpen.value && <Palette live onClose={() => paletteOpen.value = false} />}
      {launcherOpen.value && <Launcher />}
      {settingsOpen.value && <SettingsModal />}
    </>
  );
}

const CONTENDER_POOL = ["claude", "codex", "grok", "opencode"];

export function Palette({ open = true, onClose, live }: { open?: boolean; onClose?: () => void; live?: boolean } = {}) {
  return (
    <CommandPalette
      open={open}
      onClose={onClose ?? (() => paletteOpen.value = false)}
      autoFocus={live}
      lead={<Search size={15} />}
    >
      <CommandItem name="New session" desc="In a new tab" selected trail={<KbdGroup keys={["⌘", "N"]} />}
        onClick={() => { paletteOpen.value = false; activeTab.value = "home"; }} />
      <CommandItem name="Race a task across agents" desc="Fan one task out, keep the winner" trail={<KbdGroup keys={["⌘", "R"]} />}
        onClick={() => { paletteOpen.value = false; launcherOpen.value = true; }} />
      <CommandItem name="Open settings" trail={<KbdGroup keys={["⌘", ","]} />}
        onClick={() => { paletteOpen.value = false; settingsOpen.value = true; }} />
      <CommandItem name="Toggle the sidebar" trail={<KbdGroup keys={["⌘", "B"]} />}
        onClick={() => { paletteOpen.value = false; railOnly.value = !railOnly.value; }} />
      <CommandItem name="Go to file…" trail={<Kbd>⌘P</Kbd>}
        onClick={() => { paletteOpen.value = false; activePanel.value = "files"; }} />
    </CommandPalette>
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
        <div class="launch">
          <p class="note">Every contender gets the same task and its own worktree. You keep the winner.</p>
          <Composer
            label="Task"
            value={RACE_PROMPT}
            rows={2}
            lead={
              <ToggleChipGroup label="Contenders">
                {CONTENDER_POOL.map((a) => (
                  <ToggleChip key={a} pressed={picked.includes(a)}
                    lead={<AgentIcon agent={a} size="sm" />}
                    trail={picked.includes(a) ? <Check size={11} /> : undefined}
                    onClick={() => setPicked(picked.includes(a) ? picked.filter((x) => x !== a) : [...picked, a])}>
                    {a}
                  </ToggleChip>
                ))}
              </ToggleChipGroup>
            }
            actions={
              <Button variant="primary" disabled={picked.length < 2}
                onClick={() => { launcherOpen.value = false; activeTab.value = "tab-race"; }}>
                Start race
              </Button>
            }
          />
          <p class="note">
            {picked.length < 2 ? "Pick at least two." : `${picked.length} agents · one worktree each · no prompts`}
          </p>
        </div>
    </Modal>
  );
}
