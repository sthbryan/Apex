import { SidePanel } from "@apex/ui";
import { lazy, Suspense } from "preact/compat";
import { SideResize } from "@/app/layout/SideResize";
import {
  ASIDE_WIDTH_MAX,
  ASIDE_WIDTH_MIN,
  asideOpen,
  asidePanel,
  asideResizing,
  asideWidth,
  resetAsideWidth,
  setAsideWidth,
} from "@/app/layout/state";
import { t } from "@/shared/i18n";

const BrowserView = lazy(async () => ({
  default: (await import("@/features/browser/BrowserView")).BrowserView,
}));
const ApiPanel = lazy(async () => ({
  default: (await import("@/features/api/ApiPanel")).ApiPanel,
}));

export function Aside() {
  const open = asideOpen.value;
  const panel = asidePanel.value;

  return (
    <SidePanel
      flush
      side="right"
      width={asideWidth.value}
      collapsed={!open}
      data-resizing={asideResizing.value || undefined}
      grip={
        <SideResize
          side="right"
          width={asideWidth.value}
          min={ASIDE_WIDTH_MIN}
          max={ASIDE_WIDTH_MAX}
          label={t("aside.resize")}
          resizing={asideResizing}
          onWidth={setAsideWidth}
          onReset={resetAsideWidth}
        />
      }
    >
      {open ? (
        <Suspense fallback={<p class="p-3 text-faint">{t("dock.loading")}</p>}>
          {panel === "browser" ? <BrowserView /> : <ApiPanel />}
        </Suspense>
      ) : null}
    </SidePanel>
  );
}
