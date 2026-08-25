import { effect, signal } from "@preact/signals";

const STORAGE_KEY = "apex.perf-stats";

export const perfStatsEnabled = signal(
  import.meta.env.DEV && localStorage.getItem(STORAGE_KEY) === "on",
);

export function setPerfStatsEnabled(on: boolean): void {
  perfStatsEnabled.value = on;
  localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
}

export function startPerfStats(): () => void {
  if (!import.meta.env.DEV) {
    return () => {};
  }

  let teardown: (() => void) | undefined;

  const disposeEffect = effect(() => {
    teardown?.();
    teardown = undefined;

    if (!perfStatsEnabled.value) {
      return;
    }

    let cancelled = false;
    teardown = () => {
      cancelled = true;
    };

    void import("stats.js").then(({ default: Stats }) => {
      if (cancelled) {
        return;
      }
      const stats = new Stats();
      stats.showPanel(0);
      stats.dom.style.top = "auto";
      stats.dom.style.bottom = "0";
      document.body.appendChild(stats.dom);

      let frame = requestAnimationFrame(function tick() {
        stats.begin();
        stats.end();
        frame = requestAnimationFrame(tick);
      });

      teardown = () => {
        cancelAnimationFrame(frame);
        stats.dom.remove();
      };
    });
  });

  return () => {
    disposeEffect();
    teardown?.();
  };
}
