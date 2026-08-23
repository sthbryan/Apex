(function () {
  if (window.__apex) {
    return;
  }
  const cap = 500;
  const seen = [];
  let stamped = 0;
  let failures = 0;
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
    seen.push({ level: level, text: text, at: Date.now(), seq: stamped });
    if (seen.length > cap) {
      seen.shift();
    }
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
  window.__apex = {
    read: function (since, wantText) {
      return {
        url: location.href,
        title: document.title || null,
        text: wantText && document.body ? document.body.innerText.slice(0, 20000) : null,
        logs: seen.filter((entry) => entry.seq > since),
        seq: stamped,
        failures: failures,
      };
    },
  };
})();
