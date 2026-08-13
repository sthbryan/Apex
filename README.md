# Apex

Multiplexor de agentes de IA para escritorio. Corre Claude Code, Codex, Gemini, Copilot, opencode y cualquier otro CLI en una sola ventana, con estado visible, contexto compartido y aislamiento por git worktree.

## Arquitectura

- `crates/apex-proto` — protocolo de comandos y eventos sobre un trait de transporte.
- `crates/apex-core` — proyectos, sesiones, perfiles de agente y store SQLite.
- `crates/apexd` — daemon que posee todas las sesiones y sobrevive a la UI.
- `apps/desktop` — cliente Tauri v2.

El daemon es dueño de todo el estado. La app es un cliente delgado que se attachea por socket Unix.

## Desarrollo

```
cargo test
cargo run -p apexd
```

## Licencia

MIT
