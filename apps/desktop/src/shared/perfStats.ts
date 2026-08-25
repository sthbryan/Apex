import { effect, signal } from "@preact/signals";

const STORAGE_KEY = "apex.perf-stats";
const WINDOW_MS = 1000;
const REPORT_MS = 250;

export const perfStatsEnabled = signal(
  import.meta.env.DEV && localStorage.getItem(STORAGE_KEY) === "on",
);

export const framerate = signal(0);
export const slowestFrame = signal(0);

export function setPerfStatsEnabled(on: boolean): void {
  perfStatsEnabled.value = on;
  localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
}

export function keepWindow(durations: number[], window: number): number[] {
  let total = 0;
  let from = durations.length;
  while (from > 0 && total < window) {
    from -= 1;
    total += durations[from];
  }
  return durations.slice(from);
}

export function readFrames(durations: number[]): { fps: number; low: number } {
  const spent = durations.filter((gap) => gap > 0);
  if (spent.length === 0) {
    return { fps: 0, low: 0 };
  }
  const total = spent.reduce((sum, gap) => sum + gap, 0);
  const worst = spent.reduce((slowest, gap) => Math.max(slowest, gap), 0);
  return { fps: Math.round((1000 * spent.length) / total), low: Math.round(1000 / worst) };
}

export function startPerfStats(): () => void {
  if (!import.meta.env.DEV) {
    return () => {};
  }

  let stop: (() => void) | undefined;

  const disposeEffect = effect(() => {
    stop?.();
    stop = undefined;

    if (!perfStatsEnabled.value) {
      framerate.value = 0;
      slowestFrame.value = 0;
      return;
    }

    let frame = 0;
    let last = performance.now();
    let reported = last;
    let durations: number[] = [];

    const tick = (now: number) => {
      durations.push(now - last);
      last = now;

      if (now - reported >= REPORT_MS) {
        durations = keepWindow(durations, WINDOW_MS);
        const { fps, low } = readFrames(durations);
        framerate.value = fps;
        slowestFrame.value = low;
        reported = now;
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    stop = () => cancelAnimationFrame(frame);
  });

  return () => {
    disposeEffect();
    stop?.();
  };
}
