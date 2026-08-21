import { ArrowLeftRight, Check, FileText, GitBranch, Globe, Plus, Search, Settings, X } from "lucide-preact";
import { veil } from "@/shared/theme/mode";
import { Bar, Btn, Dot, Glyph, Seg, StatePill, Switch } from "@/shared/ui/atoms";

const SWATCHES = ["bg", "chrome", "raised", "overlay", "border", "accent"] as const;

export function Toolkit() {
  return (
    <div class="toolkit" style="margin-top:4px">
      <header style="font-size:20px;font-weight:700">
        Apex UI toolkit
        <span style="font-size:12.5px;font-weight:400;color:var(--muted);margin-left:10px">
          every primitive and pane type · same tokens as apps/desktop
        </span>
      </header>

      <section>
        <h2>Tokens · surfaces</h2>
        <div class="tk-grid">
          {SWATCHES.map((s) => (
            <div class="tk-cell" key={s}>
              <div class="swatch" style={`background:var(--${s === "chrome" ? "chrome" : s})`}><span>{s}</span></div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>State</h2>
        <div class="tk-row" style="gap:18px">
          <StatePill state="working">working</StatePill>
          <StatePill state="blocked">blocked</StatePill>
          <StatePill state="done">done</StatePill>
          <Dot state="failed" /><Dot state="idle" />
          <span class="fbadge M">M</span><span class="fbadge A">A</span><span class="fbadge D">D</span>
        </div>
      </section>

      <section>
        <h2>Controls</h2>
        <div class="tk-row">
          <Btn kind="primary">Primary action</Btn>
          <Btn>Ghost</Btn>
          <button class="kb-btn" aria-pressed="true">Tool button</button>
          <Seg options={[{ id: "sys", label: "System" }, { id: "light", label: "Light" }, { id: "dark", label: "Dark" }]} value="sys" onChange={() => {}} />
          <Switch checked={veil.value === "on"} onChange={(v) => veil.value = v ? "on" : "off"} />
          <span class="chip">⎇ apex/claude</span>
          <span class="pill">shares context</span>
          <span class="pill on">on</span>
          <Glyph agent="claude" /><Glyph agent="codex" /><Glyph agent="gemini" /><Glyph agent="opencode" />
        </div>
      </section>

      <section>
        <h2>Rows</h2>
        <div class="tk-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr))">
          <div class="tk-cell">
            <span class="tk-label">summary / review / task</span>
            <button class="row" aria-selected="true">
              <Dot state="working" /><Glyph agent="claude" mini />
              <span class="row-label">Refactor auth middleware</span>
              <span class="row-meta mono">2m</span>
            </button>
            <div class="rev-row">
              <Glyph agent="opencode" mini />
              <div class="rev-info"><div class="rev-title">Fix flaky checkout tests</div><div class="rev-meta">apex/codex · 2 files</div></div>
              <span class="fadd">+14</span><span class="fdel">−9</span>
              <button class="rev-act approve"><Check size={12} /></button>
            </div>
            <div class="row">
              <Dot state="working" /><span class="row-label mono">bun run dev</span>
              <button class="url-chip">:5173</button>
            </div>
          </div>
          <div class="tk-cell">
            <span class="tk-label">data</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: 260 }}>
              <span class="m-label">5h</span>
              <div class="u-track"><div class="u-fill" style="width:62%" /><span class="u-tick" style="left:58%" /></div>
              <span class="m-pct mono">62%</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: 260 }}>
              <span class="m-label">RAM</span><Bar width="56%" /><span class="m-pct mono">56%</span>
            </div>
            <div class="toast" style={{ width: 260 }}>
              <Glyph agent="codex" mini />
              <div style="flex:1"><div style="font-size:12.5px;font-weight:600">Codex finished</div></div>
              <span class="t-progress" />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2>Pane types</h2>
        <div class="tk-grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">
          <Frame label="session · acp">
            <div class="pane-head"><Glyph agent="claude" /><div><div class="pane-title">Auth middleware</div></div><StatePill state="blocked">Waiting</StatePill></div>
            <div class="pane-body" style="padding:10px;display:flex;flex-direction:column;gap:8px">
              <div class="msg-user" style="font-size:11.5px">Use passkeys instead of cookies.</div>
              <div class="perm-card"><div class="perm-head"><Plus size={12} />Run a migration?</div></div>
            </div>
          </Frame>
          <Frame label="session · tty">
            <div class="pane-head"><Glyph agent="codex" /><div class="pane-title">Checkout tests</div><StatePill state="working">Running</StatePill></div>
            <pre class="tty">{"● tests\n\n⏺ +18 −4\n\n⠸ running…"}</pre>
          </Frame>
          <Frame label="file · markdown / source">
            <div class="pane-head"><FileText size={11} /><span class="mono" style="font-size:10px;color:var(--muted)">README.md</span><span class="chip">preview</span></div>
            <div class="pane-body"><div class="mdview" style="padding:14px 16px"><h1 style="font-size:16px">Apex</h1><pre style="margin:6px 0">curl -fsSL … | sh</pre></div></div>
          </Frame>
          <Frame label="diff">
            <div class="pane-head"><GitBranch size={11} /><span class="mono" style="font-size:10px;color:var(--muted)">DockResize.tsx</span></div>
            <div class="pane-body">
              <div class="diff-head">DockResize.tsx<span class="diff-stat"><b>+24</b> <s>−11</s></span></div>
              <div class="hunk-head">@@ -12,7 +12,9 @@</div>
              <div class="diff-line del">- setWidth(x);</div>
              <div class="diff-line add">+ const next = clamp(x);</div>
            </div>
          </Frame>
          <Frame label="browser">
            <div class="pane-head"><Globe size={11} /><div class="url-box"><span class="mono" style="font-size:10px">localhost:5173</span></div></div>
            <div class="pane-body" style="display:grid;place-items:center">
              <div class="card" style="width:75%;text-align:center;padding:18px"><b style="font-size:12px">Sign in</b></div>
            </div>
          </Frame>
          <Frame label="race">
            <div class="race-col-head"><Glyph agent="claude" mini />claude<Dot state="done" /></div>
            <div class="diff-line-plain mono" style="font-size:10px">14 files +382 −96</div>
            <div class="race-decide"><b>claude</b>&nbsp;finished first<span style="flex:1" /><button class="btn btn-primary" style="height:22px;font-size:10.5px">Keep</button></div>
          </Frame>
          <Frame label="image">
            <div class="pane-head"><span class="mono" style="font-size:10px;color:var(--muted)">welcome.png</span><span class="chip">PNG</span></div>
            <div class="imgstage"><div class="ph" /></div>
          </Frame>
          <Frame label="panel (in a tab)">
            <div class="pane-head"><ArrowLeftRight size={11} /><div class="pane-title">Sessions</div><span style="flex:1" /><button class="kb-btn">Move to sidebar</button></div>
            <div class="pane-body" style="padding:8px">
              <button class="row"><Dot state="blocked" /><span class="row-label">Refactor auth</span></button>
            </div>
          </Frame>
        </div>
      </section>

      <section>
        <h2>Still to design</h2>
        <ul style="padding-left:18px;font-size:12.5px;color:var(--muted);line-height:2">
          <li>New Session / Close Session modals (radio-cards: project vs worktree)</li>
          <li>⌘P file finder · command palette rich rows</li>
          <li>ACP extras: plan checklists, slash commands, jump-to-latest</li>
          <li>Split diff · image diff · empty states · real split dragging</li>
          <li>Settings modal with shortcuts/about sections (wire to the shell)</li>
        </ul>
      </section>
    </div>
  );
}

function Frame({ label, children }: { label: string; children: any }) {
  return (
    <div class="tk-cell">
      <span class="tk-label">{label}</span>
      <div class="frame">{children}</div>
    </div>
  );
}
