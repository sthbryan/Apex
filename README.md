<h1 align="center">Apex</h1>

<p align="center">
  <img src="./apps/desktop/assets/brand/apex-icon-amber.svg" alt="Apex" width="112" height="112" />
</p>

<p align="center">
  <strong>Run a team of AI agents, not a wall of terminals.</strong>
</p>

<p align="center">
  Apex knows which agent is stuck, which one is done,<br />
  and lets them hand work to each other.
</p>

<p align="center">
  <a href="https://github.com/sthbryan/apex/releases">Download</a>
  ·
  <a href="#get-it">Install</a>
</p>

---

Three agents running. One is waiting on a permission prompt you never saw. One finished twenty minutes ago. One burned through your weekly quota. You find out by tabbing through terminals and reading scrollback.

**A multiplexer that only draws panes doesn't fix that.** tmux doesn't know what `❯ 1. Yes` means. Your shell doesn't know Claude is at 90% of its window.

**Apex reads the sessions it runs.** Each agent gets a profile — how to launch it, how to resume it, which output means *blocked*, which means *done*, where its quota lives. So the window can tell you what's happening without you looking.

---

## Screenshots

| ![Workspace](./assets/screenshots/workspace.webp) | ![Sessions](./assets/screenshots/sessions.webp) |
| :--: | :--: |
| **Workspace** — every agent pane side by side | **Sessions** — state that survives a restart |

---

## What it actually does

**Reads state, doesn't just render bytes**  
Per-agent patterns mark a session *blocked*, *working*, or *done*. Notifications when one needs you. No more discovering a stalled prompt an hour late.

**Quota before you hit the wall**  
Usage windows per agent, cached and polled, so you know what's left before an agent stops mid-task.

**Agents that talk to each other**  
Apex exposes an MCP server to every session: shared project context they can read and write, sessions they can spawn, transcripts they can inspect. One agent finds something, the others have it. A spawned agent can stand down without taking the session with it.

**Worktrees, not crossed wires**  
Each session can run in its own git worktree. Parallel agents on the same repo stop overwriting each other's work.

**A daemon owns the sessions**  
`apexd` holds every process. Close the window, reopen it, resume where the agent was — including its own native `--resume`.

**Bring your own CLI**  
Claude Code, Codex, Antigravity, Copilot, Grok, opencode, or a plain shell. Each is a TOML file; adding the next one is writing another.

---

## Built for

- Anyone running more than one agent and losing track of all of them
- Work that's worth parallelizing across agents on the same repo
- People who want their agents sharing findings instead of rediscovering them

---

## Get it

**macOS / Linux — one-liner**

```bash
curl -fsSL https://raw.githubusercontent.com/sthbryan/apex/main/install.sh | bash
```

| | |
|---|---|
| **Install script** | One-liner above (macOS Apple Silicon · Linux x86_64) |
| **Download** | [GitHub Releases](https://github.com/sthbryan/apex/releases) |
| **From source** | `cargo run -p apexd`, then `bun run tauri dev` in `apps/desktop` |

Apex drives the CLIs you already have installed, through a real PTY. Your agents behave exactly as they do in a terminal — Apex just watches.

---

## Architecture

- `crates/apex-proto` — command and event protocol over a transport trait.
- `crates/apex-core` — projects, sessions, agent profiles, and the SQLite store.
- `crates/apex-pty` — PTY processes, output ring buffers, state detection.
- `crates/apex-mcp` — the MCP surface agents use to reach Apex and each other.
- `crates/apexd` — daemon that owns every session and outlives the UI.
- `apps/desktop` — Tauri v2 client.

The daemon owns all state. The app is a thin client that attaches over a Unix socket.

---

<p align="center">
  <sub>MIT License · Made for people who ship with AI agents</sub>
</p>
