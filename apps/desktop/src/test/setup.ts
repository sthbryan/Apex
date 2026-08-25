import { beforeEach } from "vitest";

function storage(): Storage {
  let held: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(held).length;
    },
    key: (index: number) => Object.keys(held)[index] ?? null,
    getItem: (key: string) => held[key] ?? null,
    setItem: (key: string, value: string) => {
      held[key] = String(value);
    },
    removeItem: (key: string) => {
      delete held[key];
    },
    clear: () => {
      held = {};
    },
  };
}

class Watcher implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(globalThis, "ResizeObserver", { value: Watcher, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: storage(), configurable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: storage(), configurable: true });

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
