import type { AgentState, TreeStatus } from "@apex/ui";

export interface SessionItem {
  id: string;
  name: string;
  agent: string;
  state: AgentState;
  activity: string;
  elapsed: string;
  tab: string;
}

export interface WorktreeItem {
  branch: string;
  changed: number;
}

export interface FileNode {
  name: string;
  depth: number;
  expanded?: boolean;
  status?: TreeStatus;
}

export interface ChangeItem {
  path: string;
  added: number;
  removed: number;
  staged: boolean;
}

export interface ReviewItem {
  id: string;
  title: string;
  agent: string;
  branch: string;
  files: number;
  added: number;
  removed: number;
}

export interface ContenderItem {
  agent: string;
  state: AgentState;
  files: number;
  tests: string;
}

export interface CommitItem {
  sha: string;
  subject: string;
  age: string;
}

export interface TaskItem {
  command: string;
  state: AgentState;
  note: string;
  port?: string;
}

export interface PinItem {
  path: string;
  size: string;
}

export const SESSIONS: SessionItem[] = [
  {
    id: "auth",
    name: "Refactor auth middleware",
    agent: "claude",
    state: "blocked",
    activity: "waiting on db:migrate",
    elapsed: "2m",
    tab: "tab-auth",
  },
  {
    id: "checkout",
    name: "Fix flaky checkout tests",
    agent: "codex",
    state: "working",
    activity: "editing applyTax()",
    elapsed: "14m",
    tab: "tab-tty",
  },
];

export const WORKTREES: WorktreeItem[] = [
  { branch: "apex/claude", changed: 3 },
  { branch: "apex/codex", changed: 5 },
  { branch: "apex/antigravity", changed: 0 },
];

export const FILE_TREE: FileNode[] = [
  { name: "apps/desktop", depth: 0, expanded: true },
  { name: "src/shared/theme", depth: 1, expanded: true },
  { name: "tokens.css", depth: 2, status: "modified" },
  { name: "theme.css", depth: 2, status: "modified" },
  { name: "tree-row.css", depth: 2, status: "added" },
  { name: "crates/apex-core", depth: 0, expanded: false },
];

export const CHANGES: ChangeItem[] = [
  { path: "DockResize.tsx", added: 24, removed: 11, staged: true },
  { path: "race/state.ts", added: 96, removed: 0, staged: true },
  { path: "RaceView.tsx", added: 112, removed: 18, staged: true },
  { path: "tokens.css", added: 9, removed: 2, staged: false },
  { path: "theme.css", added: 31, removed: 7, staged: false },
  { path: "DockChrome.ts", added: 0, removed: 54, staged: false },
  { path: "en.ts", added: 6, removed: 1, staged: false },
];

export const REVIEWS: ReviewItem[] = [
  {
    id: "auth",
    title: "Refactor auth middleware",
    agent: "opencode",
    branch: "apex/claude",
    files: 4,
    added: 38,
    removed: 6,
  },
  {
    id: "checkout",
    title: "Fix flaky checkout tests",
    agent: "claude",
    branch: "apex/codex",
    files: 2,
    added: 14,
    removed: 9,
  },
];

export const RACE_PROMPT = "Fix the dock resize jank";

export const CONTENDERS: ContenderItem[] = [
  { agent: "claude", state: "done", files: 14, tests: "48 passed" },
  { agent: "codex", state: "working", files: 9, tests: "31 passed" },
];

export const COMMITS: CommitItem[] = [
  { sha: "31efc53", subject: "let a race go once a contender is left", age: "2h" },
  { sha: "db97013", subject: "keep one contender and drop the rest", age: "2h" },
  { sha: "5e28bbb", subject: "show the contenders side by side", age: "5h" },
  { sha: "2a261e8", subject: "count what each contender changed", age: "5h" },
  { sha: "78f121c", subject: "give races their own dock panel", age: "1d" },
];

export const TASKS: TaskItem[] = [
  { command: "bun run dev", state: "working", note: "watching · rebuilt 2s ago", port: ":5173" },
  { command: "bun test --watch", state: "idle", note: "paused" },
];

export const CONTEXT_SETUP = ["bun install", "bun run dev", "bun test"];

export const CONTEXT_PINS: PinItem[] = [
  { path: "tokens.css", size: "3.1k" },
  { path: "race.proto", size: "1.8k" },
];

export const BRANCH = { name: "main", ahead: 2, behind: 0, note: "synced 2m ago" };
