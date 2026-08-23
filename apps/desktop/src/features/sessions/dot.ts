import type { AgentState } from "@apex/ui";
import type { SessionSummary } from "@/bindings/SessionSummary";

const LIVE: AgentState[] = ["idle", "working", "blocked", "done"];

export function stateOf(session: SessionSummary): AgentState {
  if (session.exit_code !== null) {
    return session.exit_code === 0 ? "done" : "failed";
  }
  return LIVE.includes(session.state as AgentState) ? (session.state as AgentState) : "idle";
}
