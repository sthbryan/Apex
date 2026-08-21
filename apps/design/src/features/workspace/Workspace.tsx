import { useEffect } from "preact/hooks";
import {
  ArrowLeftRight, Check, ChevronRight, FileText, GitBranch, Globe, Lock,
  Plus, RotateCw, Search, Send, Settings, X,
} from "lucide-preact";
import {
  activeTab, consoleOpen, fmode, launcherOpen,
  openPop, raceAsking, raceKept, removedProject,
  settingsOpen, showWelcome, toastCount, uaWindow,
} from "@/app/state";
import { SettingsModal } from "@/features/workspace/Settings";
import { AgentIcon, Bar, Button, Card, Chip, Dot, Pill, Segmented, StatePill, Toast, ToastStack } from "@apex/ui";

const TABS = [
  { id: "tab-auth", title: "Refactor auth middleware" },
  { id: "tab-browser", title: "localhost:5173", icon: Globe },
  { id: "tab-race", title: "Race · dock resize jank", icon: ArrowLeftRight },
  { id: "tab-file", title: "README.md", icon: FileText },
  { id: "tab-diff", title: "± DockResize.tsx", icon: GitBranch },
];

export function Workspace() {
  useEffect(() => {
    const t = setTimeout(() => toastCount.value = 0, 6500);
    return () => clearTimeout(t);
  }, []);

  return (
    <main class="main">
      {showWelcome.value ? <Welcome /> : <Sessions />}
      <Overlays />
    </main>
  );
}

function Welcome() {
  return (
    <section class="view" style="position:relative;align-items:center;justify-content:center;padding:32px;overflow:hidden">
      <div style="position:relative;width:min(660px,100%);display:flex;flex-direction:column;align-items:center">
        <div style="text-align:center;margin-bottom:22px">
          <h1 style="font-size:44px;font-weight:600;letter-spacing:.14em;margin:0">APEX</h1>
          <p style="margin-top:6px;color:var(--apex-muted);font-size:14.5px">Run a team of AI agents, not a wall of terminals.</p>
        </div>
        <form class="composer" onSubmit={(e) => { e.preventDefault(); showWelcome.value = false; activeTab.value = "tab-auth"; }}>
          <textarea rows={2} placeholder="Ask, delegate, or start a task…" />
          <div class="composer-bar">
            <div class="launch-agents">
              <button type="button" class="launch-chip" aria-pressed="true"><AgentIcon agent="claude" size="sm" />claude</button>
              <button type="button" class="launch-chip"><AgentIcon agent="codex" size="sm" />codex</button>
              <button type="button" class="launch-chip"><AgentIcon agent="gemini" size="sm" />gemini</button>
            </div>
            <span style="flex:1" />
            <Button type="submit" variant="primary"><Send size={13} />Start</Button>
          </div>
        </form>
        <div style="display:flex;gap:8px;margin-top:16px">
          {["Refactor auth middleware", "Race a task across agents"].map((t) => (
            <Button key={t} size="sm" class="rounded-full">{t}</Button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Sessions() {
  return (
    <section class="view">
      <div class="tabbar">
        {TABS.map((t) => (
          <div key={t.id} class="tab" aria-selected={activeTab.value === t.id} onClick={() => activeTab.value = t.id}>
            {t.icon ? <t.icon size={13} style="color:var(--apex-muted);flex:none" /> : <AgentIcon agent="claude" size="sm" />}
            <button class="tab-title">{t.title}</button>
          </div>
        ))}
        <button class="tab-add" title="New session in a new tab" onClick={() => showWelcome.value = true}><Plus size={14} /></button>
      </div>

      <div class="panes">
        {activeTab.value === "tab-auth" && <AuthSplit />}
        {activeTab.value === "tab-browser" && <BrowserPane />}
        {activeTab.value === "tab-race" && <RacePane />}
        {activeTab.value === "tab-file" && <FilePane />}
        {activeTab.value === "tab-diff" && <DiffPane />}
      </div>
    </section>
  );
}

function AuthSplit() {
  return (
    <div class="pane pane-group">
      <article class="pane">
        <header class="pane-head">
          <AgentIcon agent="claude" />
          <div style="min-width:0">
            <div class="pane-title">Refactor auth middleware</div>
            <div class="pane-sub"><Chip>⎇ apex/claude</Chip><span class="mono">2m 14s</span></div>
          </div>
          <StatePill state="blocked" class="ml-auto">Waiting</StatePill>
        </header>
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
        <div class="reply-bar">
          <div class="reply-box">
            <input placeholder="Reply to claude…" />
            <button class="reply-send"><Send size={13} /></button>
          </div>
        </div>
      </article>

      <article class="pane">
        <header class="pane-head">
          <AgentIcon agent="codex" />
          <div style="min-width:0">
            <div class="pane-title">Fix flaky checkout tests</div>
            <div class="pane-sub"><Chip>⎇ apex/codex</Chip><span class="mono">14m</span></div>
          </div>
          <StatePill state="working" class="ml-auto">Running</StatePill>
        </header>
        <pre class="tty">{"● Fix the flaky checkout tests\n\n⏺ The retry helper swallows the assertion.\n\n⏺ Patch tests/checkout.test.ts\n  ⎿ +18 −4\n\n⠸ Running the suite twice more…\n\n❯ "}<span class="cursor" /></pre>
      </article>
    </div>
  );
}

function BrowserPane() {
  return (
    <article class={`pane browser-pane${consoleOpen.value ? " console-open" : ""}`}>
      <div class="browser-bar">
        <Button variant="subtle" size="sm" iconOnly title="Reload"><RotateCw size={13} /></Button>
        <div class="url-box"><Lock size={11} style="color:var(--apex-state-done)" /><input value="localhost:5173/login" /></div>
        <Button variant="subtle" size="sm" iconOnly title="Console" onClick={() => consoleOpen.value = !consoleOpen.value}>
          <Search size={13} /><span class="err-count">2</span>
        </Button>
      </div>
      <div class="browser-body">
        <Card class="w-[min(520px,100%)] items-center text-center">
          <b style="font-size:15px">Sign in with a passkey</b>
          <p style="font-size:12px;color:var(--apex-muted)">The dev server preview of the new auth flow.</p>
          <Button variant="primary">Continue</Button>
        </Card>
      </div>
      <div class="console">
        <div class="console-head">Console<button style="margin-left:auto;color:var(--apex-tty-dim)">Clear</button></div>
        <div class="console-list">
          <div class="l-err">[auth] Failed to verify legacy cookie: invalid signature</div>
          <div class="l-warn">[webauthn] Challenge expired after 120s, retrying</div>
          <div class="l-info">[vite] hmr update /src/auth/passkey.ts</div>
        </div>
      </div>
    </article>
  );
}

function RacePane() {
  const kept = raceKept.value;
  return (
    <article class="pane">
      <div class="race-view">
        <p class="race-task">Fix the dock resize jank</p>
        <div class="race-cols">
          <div class={`race-col${kept ? "" : ""}`} style={kept ? undefined : undefined}>
            <div class="race-col-head">
              <AgentIcon agent="claude" size="sm" /><span class="c-name">claude</span>
              {kept && <span class="dropped-tag" style="color:var(--apex-state-done);border-color:color-mix(in oklab, var(--apex-state-done) 40%, transparent)">kept</span>}
              {!kept && <Dot state="done" />}
            </div>
            <p class="diff-line-plain">14 files <span class="fadd">+382</span><span class="fdel">−96</span></p>
          </div>
          <div class={`race-col${kept ? " dropped" : ""}`}>
            <div class="race-col-head">
              <AgentIcon agent="codex" size="sm" /><span class="c-name">codex</span>
              {!kept && <Dot state="working" />}
            </div>
            <p class="c-note">{kept ? "Dropped." : "Still working…"}</p>
          </div>
          <div class="race-col dropped">
            <div class="race-col-head"><AgentIcon agent="gemini" size="sm" /><span class="c-name">gemini</span><span class="dropped-tag">dropped</span></div>
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
    </article>
  );
}

function FilePane() {
  return (
    <article class="pane">
      <div class="pane-toolbar">
        <FileText size={12} style="color:var(--apex-muted)" />
        <span class="mono">docs/README.md</span>
        <Chip>markdown</Chip>
        <span style="flex:1" />
        <Segmented
          label="File view"
          options={[{ value: "preview", label: "Preview" }, { value: "source", label: "Source" }]}
          value={fmode.value}
          onChange={(v) => fmode.value = v as "preview" | "source"}
        />
      </div>
      <div class="pane-body">
        {fmode.value === "preview" ? (
          <div class="mdview">
            <h1>Apex</h1>
            <p>Run a team of AI agents, not a wall of terminals.</p>
            <h2>Install</h2>
            <pre>curl -fsSL https://apex.dev/install.sh | sh</pre>
            <h2>What you get</h2>
            <ul>
              <li><strong>Sessions</strong> — terminal or native rendering per agent</li>
              <li><strong>Races</strong> — fan one task across agents, keep the winner</li>
            </ul>
          </div>
        ) : (
          <div class="codeview">
            <div class="cl"><span class="ln">1</span><span class="tok-c"># Apex</span></div>
            <div class="cl"><span class="ln">2</span></div>
            <div class="cl"><span class="ln">3</span>Run a team of AI agents.</div>
            <div class="cl"><span class="ln">5</span><span class="tok-c">## Install</span></div>
            <div class="cl"><span class="ln">7</span>    curl -fsSL https://apex.dev/install.sh | sh</div>
          </div>
        )}
      </div>
    </article>
  );
}

function DiffPane() {
  return (
    <article class="pane">
      <div class="pane-toolbar">
        <GitBranch size={12} style="color:var(--apex-muted)" />
        <span class="mono">apex/claude · DockResize.tsx</span>
        <Chip>staged</Chip>
        <span style="flex:1" />
        <span class="mono" style="font-size:10.5px">2 / 4</span>
      </div>
      <div class="pane-body">
        <div class="diff-wrap">
          <div class="diff-file">
            <div class="diff-head">apps/desktop/…/DockResize.tsx<span class="diff-stat"><b>+24</b> <s>−11</s></span></div>
            <div class="hunk-head">@@ -12,7 +12,9 @@<span class="hh-acts"><button class="hh-btn">Stage hunk</button></span></div>
            <div class="diff-line ctx">{"  const onPointer = (event) => {"}</div>
            <div class="diff-line del">{"-    setWidth(event.clientX - origin);"}</div>
            <div class="diff-line add">{"+    const next = clamp(event.clientX - origin, rail, max);"}</div>
            <div class="diff-line ctx">{"  };"}</div>
          </div>
        </div>
      </div>
    </article>
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

function Pop({ title, children }: { title: string; children: any }) {
  return (
    <div class="popover" onClick={(e) => e.stopPropagation()}>
      <div class="pop-head">{title}<span style="flex:1" /><button onClick={() => openPop.value = null}><X size={12} /></button></div>
      {children}
    </div>
  );
}

function UsagePop() {
  return (
    <Pop title="claude · usage">
      <div class="ua-window" role="group">
        <button aria-pressed={uaWindow.value === "5h"} onClick={() => uaWindow.value = "5h"}>5h</button>
        <button aria-pressed={uaWindow.value === "7d"} onClick={() => uaWindow.value = "7d"}>7d</button>
      </div>
      <div class="ua-big">
        <span class="n">{uaWindow.value === "5h" ? "62%" : "34%"}</span>
        <span style="font-size:11px;color:var(--apex-muted)">resets in 2h 30m · Tue 4:00</span>
      </div>
      <div class="u-row"><span class="u-win">used</span><Bar value={uaWindow.value === "5h" ? 62 : 34} tick={58} size="sm" label="used" /><span class="u-eta">pace ✓</span></div>
      <div class="u-row"><span class="u-win">7d</span><Bar value={34} tone="done" size="sm" label="7 day usage" /><span class="u-eta">on pace</span></div>
      <div class="pop-head" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--apex-border)">codex<span class="ph-sub" style="color:var(--apex-state-blocked)">71% · over pace</span></div>
      <div class="u-row"><span class="u-win">5h</span><Bar value={71} tone="blocked" size="sm" label="codex usage" /><span class="u-eta">tight</span></div>
    </Pop>
  );
}

function ResourcesPop() {
  return (
    <Pop title="Resources">
      <div class="pop-head" style="margin-top:2px;padding:0">CPU<span class="ph-sub mono" style="color:var(--apex-text)">23%</span><span class="ph-sub mono">14 cores</span></div>
      <svg class="spark" viewBox="0 0 300 54" preserveAspectRatio="none">
        <path d="M0 40 C 20 38, 30 34, 45 35 S 70 28, 85 30 S 110 22, 125 26 S 150 30, 165 24 S 190 18, 205 22 S 230 28, 245 20 S 270 14, 285 18 L 300 16 L 300 54 L 0 54 Z" fill="var(--apex-accent)" opacity="0.14" />
        <path d="M0 40 C 20 38, 30 34, 45 35 S 70 28, 85 30 S 110 22, 125 26 S 150 30, 165 24 S 190 18, 205 22 S 230 28, 245 20 S 270 14, 285 18 L 300 16" fill="none" stroke="var(--apex-accent)" stroke-width="1.6" />
      </svg>
      <div class="meter"><span class="m-label">Memory</span><Bar value={56} label="Memory" /><span class="m-pct mono">56%</span><span class="m-detail">18.2/32 GB</span></div>
      <div class="meter"><span class="m-label">Apex</span><Bar value={12} tone="done" label="Apex memory" /><span class="m-pct mono">12%</span><span class="m-detail">312 MB</span></div>
      <div class="sess-res-row"><AgentIcon agent="claude" size="sm" /><span style="flex:1">Refactor auth middleware</span><span class="mono" style="font-size:10.5px;color:var(--apex-muted)">412 MB · 8%</span></div>
      <div class="sess-res-row"><AgentIcon agent="codex" size="sm" /><span style="flex:1">Fix flaky checkout tests</span><span class="mono" style="font-size:10.5px;color:var(--apex-muted)">188 MB · 3%</span></div>
    </Pop>
  );
}

function NotificationsPop() {
  const notices = [
    ["blocked", "Waiting for your approval", "gemini wants to run a migration", "2m"],
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

function TargetPop() {
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

function ProjectsPop() {
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

function Launcher() {
  const [picked, setPicked] = (globalThis as any).__picked ??= { v: new Set(["claude", "codex"]) };
  return (
    <div class="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) launcherOpen.value = false; }}>
      <div class="modal" style="width:min(520px,94%);height:auto" onClick={(e) => e.stopPropagation()}>
        <Button class="modal-close" variant="subtle" size="lg" iconOnly title="Close" onClick={() => launcherOpen.value = false}><X size={13} /></Button>
        <div class="modal-main" style="padding:20px 22px">
          <div class="set-title">Race a task</div>
          <div class="set-sub">Every contender gets the same task and its own worktree. You keep the winner.</div>
          <textarea class="commit-msg" style="min-height:64px">Fix the dock resize jank</textarea>
          <div class="pl-label" style="padding-left:0">Who runs it</div>
          <div class="launch-agents">
            {["claude", "codex", "gemini", "opencode"].map((a) => (
              <button key={a} class="launch-chip" aria-pressed={picked.v.has(a)}
                onClick={() => { picked.v.has(a) ? picked.v.delete(a) : picked.v.add(a); setPicked({ v: picked.v }); }}>
                <AgentIcon agent={a} size="sm" />{a}{picked.v.has(a) && <Check size={11} />}
              </button>
            ))}
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
            <span style="font-size:11.5px;color:var(--apex-muted);flex:1">
              {picked.v.size < 2 ? "Pick at least two." : `${picked.v.size} agents · one worktree each · no prompts`}
            </span>
            <Button variant="primary" disabled={picked.v.size < 2}
              onClick={() => { launcherOpen.value = false; showWelcome.value = false; activeTab.value = "tab-race"; }}>
              Start race
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
