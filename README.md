<h1 align="center">Apex</h1>

<p align="center">
  <img src="./apps/desktop/assets/brand/apex-icon-amber.svg" alt="Apex" width="112" height="112" />
</p>

<p align="center">
  <strong>The desktop multiplexer for AI agent CLIs.</strong>
</p>

<p align="center">
  Every agent in one window. Visible state.<br />
  No more tab roulette.
</p>

<p align="center">
  <a href="https://github.com/sthbryan/apex/releases">Download</a>
  ·
  <a href="#get-it">Install</a>
</p>

---

Your agents already live in the terminal: **Claude Code, Codex, Gemini, Copilot, opencode**, and whatever ships next month. Each one in its own tab, its own directory, its own half-remembered state.

**The problem?** You lose the thread. Which agent is running, which branch it touched, what it was doing before you switched away — all of it lives in your head instead of on screen.

**Apex gives you the full picture.** One window where every session is visible, isolated by git worktree, and still running when you come back.

---

## Screenshots

| ![Workspace](./assets/screenshots/workspace.webp) | ![Sessions](./assets/screenshots/sessions.webp) |
| :--: | :--: |
| **Workspace** — every agent pane side by side | **Sessions** — state that survives a restart |

---

## Why people open Apex

**Every agent, one window**  
Claude Code, Codex, Gemini, Copilot, opencode, or any CLI you point at it. Same panes, same shortcuts.

**Sessions that outlive the UI**  
A daemon owns every session. Close the app, reopen it, your agents are still there.

**Isolation without ceremony**  
Each session gets its own git worktree. Agents don't step on each other, and neither do you.

**Shared context where it fits**  
Apex merges into the agent's own config instead of inventing a parallel one.

---

## Built for

- Devs running more than one agent at a time
- Anyone tired of losing an agent's state to a closed terminal
- People who want worktree isolation without wiring it up by hand

---

## Get it

| | |
|---|---|
| **Download** | [GitHub Releases](https://github.com/sthbryan/apex/releases) |
| **From source** | `cargo run -p apexd` + `bun run tauri dev` in `apps/desktop` |

Apex talks to the CLIs you already have installed. It doesn't wrap them in a new protocol — your agents keep behaving exactly as they do in a terminal.

---

## Architecture

- `crates/apex-proto` — command and event protocol over a transport trait.
- `crates/apex-core` — projects, sessions, agent profiles, and the SQLite store.
- `crates/apexd` — daemon that owns every session and outlives the UI.
- `apps/desktop` — Tauri v2 client.

The daemon owns all state. The app is a thin client that attaches over a Unix socket.

---

## Roadmap

**Shipped**

- [x] Multiple agent panes in one workspace
- [x] Sessions that survive app restarts
- [x] Git worktree isolation per session
- [x] Shared context merged into agent configs
- [x] Split panes to the side

**Next up**

- [ ] Signed installers and auto-update
- [ ] Per-project agent presets
- [ ] Task queue across agents

---

<p align="center">
  <sub>MIT License · Made for people who ship with AI agents</sub>
</p>
