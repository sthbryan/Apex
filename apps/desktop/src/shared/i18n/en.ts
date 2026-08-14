export const en = {
  app: {
    name: "Apex",
  },
  status: {
    connecting: "connecting",
    ready: "ready",
    failed: "failed",
  },
  daemon: {
    unreachable: "Could not reach apexd.",
    retry: "Retry",
  },
  dock: {
    sessions: "Sessions",
  },
  projects: {
    none: "No project",
    open: "Open project…",
    empty: "Open a project to get started.",
    elsewhere: "Other projects",
  },
  usage: {
    title: "Subscription usage",
    resetsIn: "resets in {away} · {when}",
    resetsAt: "resets {when}",
    overPace: "over pace",
  },
  resources: {
    sampling: "Sampling…",
    cpu: "CPU",
    gpu: "GPU",
    memory: "Memory",
    swap: "Swap",
    system: "System",
    cores: "{count} cores",
    bySession: "By session",
    sessionSummary: "{count} sessions · {memory} · {cpu}% CPU",
    noSessions: "No sessions running.",
    noQuota: "No data.",
    refresh: "Refresh now",
    kill: "Kill process {pid}",
  },
  settings: {
    title: "Settings",
    close: "Close settings",
    theme: "Theme",
    themeHint: "Follows your system.",
    language: "Language",
    languageHint: "Applies instantly.",
    agentsHint: "Agents are TOML files in {path} — drop one in to add a CLI.",
  },
  theme: {
    system: "System",
    light: "Light",
    dark: "Dark",
  },
  toolbar: {
    newSession: "New session",
  },
  notify: {
    blocked: "An agent is waiting for you",
    done: "An agent finished",
  },
  sessions: {
    waiting: "Waiting for you",
    live: "Running",
    finished: "Finished",
    empty: "No sessions yet.",
    exited: "exited {code}",
    close: "Close session",
    dismiss: "Dismiss",
    clearFinished: "Clear finished",
  },
  workspace: {
    empty: "Nothing open.",
    emptyHint: "Press {shortcut} to start a session.",
  },
  palette: {
    placeholder: "Type a command…",
    empty: "Nothing matches.",
    newSession: "New session: {agent}",
    resume: "Resume {agent}: {label}",
    goTo: "Go to: {title}",
    splitRightWith: "Split right: {agent}",
    splitDownWith: "Split down: {agent}",
    closePane: "Close pane",
    closeTab: "Close tab",
    settings: "Settings",
  },
  error: {
    unsupported_version: "The daemon speaks a different protocol version.",
    unauthorized: "This client is not allowed to run that command.",
    malformed_request: "The daemon could not understand the request.",
    not_found: "The daemon could not find what was requested.",
    internal: "The daemon hit an internal error.",
  },
} as const;

type WritableDeep<T> = T extends string ? string : { -readonly [K in keyof T]: WritableDeep<T[K]> };

type DotPath<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : DotPath<T[K], `${P}${K}.`>;
}[keyof T & string];

export type Messages = WritableDeep<typeof en>;
export type MessageKey = DotPath<typeof en>;
