(function () {
  if (window.__apex) {
    return;
  }
  const cap = 500;
  const seen = [];
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
    seen.push({ level: level, text: text, at: Date.now() });
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
    snapshot: function () {
      const out = seen.slice();
      seen.length = 0;
      return {
        url: location.href,
        title: document.title || null,
        text: document.body ? document.body.innerText.slice(0, 20000) : null,
        logs: out,
      };
    },
  };
})();
