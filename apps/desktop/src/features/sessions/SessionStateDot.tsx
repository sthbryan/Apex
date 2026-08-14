import cn from "cnfast";
import type { SessionSummary } from "@/bindings/SessionSummary";

type Props = {
  session: SessionSummary;
};

const STATE_STYLES: Record<string, string> = {
  idle: "border border-state-idle",
  working: "bg-state-working",
  blocked: "bg-state-blocked",
  done: "bg-state-done",
};

export function SessionStateDot({ session }: Props) {
  const live = session.exit_code === null;
  return (
    <span class="relative flex size-2 shrink-0">
      {live && session.state === "working" && (
        <span class="absolute inset-0 animate-ping rounded-full bg-state-working opacity-60" />
      )}
      <span class={cn("relative size-2 rounded-full", dotStyle(session))} />
    </span>
  );
}

function dotStyle(session: SessionSummary): string {
  if (session.exit_code !== null) {
    return session.exit_code === 0 ? "bg-state-done" : "bg-state-failed";
  }
  return STATE_STYLES[session.state] ?? STATE_STYLES.idle;
}
