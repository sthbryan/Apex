import { signal } from "@preact/signals";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ControlsSide = "start" | "end" | "none";

type Layout = {
  side: ControlsSide;
  inset: number;
};

const OVERLAID_BY_NATIVE_CONTROLS: Record<string, Layout> = {
  macos: { side: "start", inset: 78 },
};

const NATIVE_TITLEBAR_IS_SEPARATE: Layout = { side: "none", inset: 0 };

export const controlsSide = signal<ControlsSide>("none");

export function applyWindowControls(platform: string, fullscreen: boolean): void {
  const layout = fullscreen
    ? NATIVE_TITLEBAR_IS_SEPARATE
    : (OVERLAID_BY_NATIVE_CONTROLS[platform] ?? NATIVE_TITLEBAR_IS_SEPARATE);
  const style = document.documentElement.style;
  style.setProperty("--apex-controls-start", `${layout.side === "start" ? layout.inset : 0}px`);
  style.setProperty("--apex-controls-end", `${layout.side === "end" ? layout.inset : 0}px`);
  controlsSide.value = layout.side;
}

export async function watchFullscreen(platform: string): Promise<() => void> {
  const window = getCurrentWindow();
  const sync = async () => {
    applyWindowControls(platform, await window.isFullscreen());
  };

  await sync();
  const unlistenResized = await window.onResized(() => void sync());
  return () => {
    unlistenResized();
  };
}
