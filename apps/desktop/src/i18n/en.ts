export const en = {
  "app.name": "apex",
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

  "error.unsupported_version": "The daemon speaks a different protocol version.",
  "error.unauthorized": "This client is not allowed to run that command.",
  "error.malformed_request": "The daemon could not understand the request.",
  "error.not_found": "The daemon could not find what was requested.",
  "error.internal": "The daemon hit an internal error.",
};

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;
