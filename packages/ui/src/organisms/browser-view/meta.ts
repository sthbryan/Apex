import type { ComponentMeta } from "@/lib/meta";
import { BrowserLog } from "@/organisms/browser-view/BrowserView";

export const browserViewMeta: ComponentMeta = {
  name: "BrowserView",
  layer: "organism",
  description: "Embedded web preview with an address bar and a collapsible console.",
  rule: "The address bar reflects the webview, it never leads it. The console stays shut until something is logged.",
  component: BrowserLog,
  variants: [
    { name: "error", props: { level: "error" }, children: "[auth] invalid signature" },
    { name: "warn", props: { level: "warn" }, children: "[webauthn] challenge expired" },
    { name: "info", props: { level: "info" }, children: "[vite] hmr update" },
  ],
};
