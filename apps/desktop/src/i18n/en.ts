export const en = {
  "app.name": "Apex",
  "status.connecting": "connecting",
  "status.ready": "ready",
  "status.failed": "failed",

  "agents.detecting": "Detecting agents…",
  "agents.available": "Available",
  "agents.missing": "Not installed",
  "agents.notFound": 'could not find "{command}" on the PATH',
  "agents.supportsResume": "resume",
  "agents.dot.available": "available",
  "agents.dot.missing": "not installed",

  "daemon.unreachable": "Could not reach apexd.",
  "daemon.retry": "Retry",

  "dock.sessions": "Sessions",
  "dock.agents": "Agents",
  "dock.toggle": "Toggle sidebar",

  "sessions.live": "Running",
  "sessions.empty": "No sessions yet.",
  "sessions.exited": "exited {code}",
  "sessions.close": "Close session",

  "workspace.empty": "Nothing open.",
  "workspace.emptyHint": "Press {shortcut} to start a session.",

  "palette.placeholder": "Type a command…",
  "palette.empty": "Nothing matches.",
  "palette.newSession": "New session: {agent}",
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
