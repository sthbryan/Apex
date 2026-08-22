import type { AgentState, BarTone } from "@apex/ui";

export interface UsageWindow {
  id: "5h" | "7d";
  label: string;
}

export const USAGE_WINDOWS: UsageWindow[] = [
  { id: "5h", label: "5h" },
  { id: "7d", label: "7d" },
];

export const USAGE = {
  agent: "claude",
  updated: "updated 2m ago",
  used: { "5h": 62, "7d": 34 } as Record<UsageWindow["id"], number>,
  pace: 58,
  paceNote: "pace ✓",
  resets: "resets in 2h 30m · Tue 4:00",
  week: { value: 34, detail: "on pace" },
};

export interface UsageAgent {
  agent: string;
  pace: string;
  window: string;
  value: number;
  tone: BarTone;
  detail: string;
  unavailable?: boolean;
}

export const USAGE_AGENTS: UsageAgent[] = [
  { agent: "codex", pace: "over pace", window: "5h", value: 71, tone: "blocked", detail: "tight" },
  { agent: "grok", pace: "plenty left", window: "5h", value: 12, tone: "done", detail: "easy", unavailable: true },
];

export const CPU = {
  value: "23%",
  note: "14 cores · user 18% sys 5%",
  points: [12, 14, 18, 16, 22, 19, 26, 23, 20, 25, 29, 26, 21, 27, 31, 28, 23],
};

export interface ResourceMeter {
  label: string;
  value: number;
  tone?: BarTone;
  detail: string;
}

export const RESOURCE_METERS: ResourceMeter[] = [
  { label: "Memory", value: 56, detail: "18.2/32 GB" },
  { label: "Swap", value: 6, tone: "done", detail: "0.18/3 GB" },
  { label: "Apex", value: 12, tone: "done", detail: "312 MB" },
];

export const RESOURCE_TOTAL = "882 MB · 16%";

export interface Proc {
  pid: number;
  cmd: string;
  mem: string;
  agent: boolean;
}

export interface ResourceSession {
  id: string;
  name: string;
  state: AgentState;
  mem: string;
  pct: string;
  procs: Proc[];
}

export const RESOURCE_SESSIONS: ResourceSession[] = [
  {
    id: "auth",
    name: "Refactor auth middleware",
    state: "working",
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
    state: "done",
    mem: "362 MB",
    pct: "2%",
    procs: [{ pid: 3987, cmd: "codex", mem: "288 MB", agent: true }],
  },
];

export interface Notice {
  id: string;
  state: AgentState;
  title: string;
  body: string;
  age: string;
}

export const NOTICES: Notice[] = [
  { id: "approval", state: "blocked", title: "Waiting for your approval", body: "antigravity wants to run a migration", age: "2m" },
  { id: "codex", state: "done", title: "Codex finished", body: "Fix the race settle flow · exit 0", age: "14m" },
  { id: "quota", state: "failed", title: "Weekly quota almost gone", body: "claude · 71% used, over pace", age: "1h" },
];

export const TARGET = { name: "apex-sandbox", detail: "main · 16 changed" };

export interface Target {
  id: string;
  name: string;
  detail: string;
  state?: AgentState;
  dim?: boolean;
}

export const TARGET_WORKTREES: Target[] = [
  { id: "auth", name: "Refactor auth middleware", detail: "apex/claude · 3 changed", state: "working" },
  { id: "checkout", name: "Fix flaky checkout tests", detail: "apex/codex · 5 changed", state: "working" },
];

export const TARGET_BRANCHES: Target[] = [
  { id: "release", name: "release", detail: "behind 4", dim: true },
];

export interface Project {
  id: string;
  name: string;
  path: string;
  note?: string;
  tone?: "accent" | "blocked";
  current?: boolean;
  removable?: boolean;
}

export const PROJECTS: Project[] = [
  { id: "sandbox", name: "apex-sandbox", path: "~/Documents/Codes/apex-sandbox", note: "2 running", tone: "accent", current: true },
  { id: "docs", name: "apex-docs", path: "~/Documents/Codes/apex-docs", note: "1 waiting", tone: "blocked", removable: true },
];
