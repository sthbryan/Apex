export const en = {
  "app.name": "Apex",
  "status.connecting": "connecting",
  "status.ready": "ready",
  "status.failed": "failed",

  "daemon.unreachable": "Could not reach apexd.",
  "daemon.retry": "Retry",

  "dock.sessions": "Sessions",

  "projects.none": "No project",
  "projects.open": "Open project…",
  "projects.empty": "Open a project to get started.",
  "projects.elsewhere": "Other projects",

  "usage.title": "Subscription usage",
  "usage.resetsIn": "resets in {away} · {when}",
  "usage.resetsAt": "resets {when}",

  "status.sessions": "{count} live",

  "resources.sampling": "Sampling…",
  "resources.system": "System",
  "resources.cpu": "CPU",
  "resources.gpu": "GPU",
  "resources.memory": "Memory",
  "resources.swap": "Swap",
  "resources.cores": "cores",
  "resources.bySession": "By session",
  "resources.noSessions": "No sessions running.",
  "resources.noQuota": "No data.",
  "resources.refresh": "Refresh now",
  "resources.kill": "Kill process {pid}",

  "toolbar.newSession": "New session",
  "toolbar.theme.system": "Theme: system",
  "toolbar.theme.light": "Theme: light",
  "toolbar.theme.dark": "Theme: dark",

  "notify.blocked": "An agent is waiting for you",
  "notify.done": "An agent finished",
  "sessions.waiting": "Waiting for you",
  "sessions.live": "Running",
  "sessions.finished": "Finished",
  "sessions.empty": "No sessions yet.",
  "sessions.exited": "exited {code}",
  "sessions.close": "Close session",
  "sessions.dismiss": "Dismiss",
  "sessions.clearFinished": "Clear finished",

  "workspace.empty": "Nothing open.",
  "workspace.emptyHint": "Press {shortcut} to start a session.",

  "palette.placeholder": "Type a command…",
  "palette.empty": "Nothing matches.",
  "palette.newSession": "New session: {agent}",
  "palette.resume": "Resume {agent}: {label}",
  "palette.goTo": "Go to: {title}",
  "palette.splitRight": "Split right",
  "palette.splitDown": "Split down",
  "palette.closePane": "Close pane",
  "palette.closeTab": "Close tab",

  "error.unsupported_version": "The daemon speaks a different protocol version.",
  "error.unauthorized": "This client is not allowed to run that command.",
  "error.malformed_request": "The daemon could not understand the request.",
  "error.not_found": "The daemon could not find what was requested.",
  "error.internal": "The daemon hit an internal error.",
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
