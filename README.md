# Apex

Desktop multiplexer for AI agent CLIs. Run Claude Code, Codex, Gemini, Copilot, opencode, and any other CLI in one window, with visible state, shared context, and isolation via git worktrees.

## Architecture

- `crates/apex-proto` — command and event protocol over a transport trait.
- `crates/apex-core` — projects, sessions, agent profiles, and the SQLite store.
- `crates/apexd` — daemon that owns every session and outlives the UI.
- `apps/desktop` — Tauri v2 client.

The daemon owns all state. The app is a thin client that attaches over a Unix socket.

## Development

```
cargo test
cargo run -p apexd
```

## License

MIT
