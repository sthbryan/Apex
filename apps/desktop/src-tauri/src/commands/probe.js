(function () {
  if (window.top === window.self || window.__apex) {
    return;
  }
  const cap = 500;
  const seen = [];
  let stamped = 0;
  let failures = 0;
  const born = Date.now();
  const tell = (message) => {
    try {
      parent.postMessage(Object.assign({ apex: true }, message), "*");
    } catch (error) {}
  };
  const show = (value) => {
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  };
  const push = (level, text) => {
    stamped += 1;
    if (level === "error") {
      failures += 1;
    }
    const entry = { level: level, text: text, at: Date.now(), seq: stamped };
    seen.push(entry);
    if (seen.length > cap) {
      seen.shift();
    }
    tell({ kind: "logs", logs: [entry], failures: failures });
  };
  for (const level of ["log", "info", "warn", "error", "debug"]) {
    const original = console[level];
    console[level] = function () {
      const args = Array.prototype.slice.call(arguments);
      push(level, args.map(show).join(" "));
      original.apply(console, args);
    };
  }
  window.addEventListener("error", (event) => push("error", event.message));
  window.addEventListener("unhandledrejection", (event) => push("error", show(event.reason)));

  window.open = function (url) {
    if (url) {
      tell({ kind: "leaving", url: String(new URL(url, location.href)) });
    }
    return null;
  };
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
      if (!link) {
        return;
      }
      const target = new URL(link.getAttribute("href"), location.href);
      if (target.origin === location.origin && link.target !== "_blank") {
        return;
      }
      event.preventDefault();
      tell({ kind: "leaving", url: String(target) });
    },
    true,
  );

  const read = (since) => ({
    url: location.href,
    title: document.title || null,
    logs: seen.filter((entry) => entry.seq > since),
    seq: stamped,
    born: born,
    failures: failures,
  });

  window.addEventListener("message", (event) => {
    const asked = event.data;
    if (!asked || asked.apex !== "ask") {
      return;
    }
    if (asked.kind === "read") {
      tell({ kind: "page", request: asked.request, page: read(asked.since || 0) });
      return;
    }
    if (asked.kind === "back") {
      history.back();
    }
    if (asked.kind === "forward") {
      history.forward();
    }
    if (asked.kind === "reload") {
      location.reload();
    }
  });

  const announce = () =>
    tell({ kind: "loaded", url: location.href, title: document.title || null });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", announce);
  } else {
    announce();
  }
  window.addEventListener("load", announce);
  window.__apex = { read: read };
})();
