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
  closeAside,
  openAside,
  resetAsideWidth,
  setAsideWidth,
} from "@/app/layout/state";
import { groupOn } from "@/features/settings/toolGroups";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

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
      class="apex-panel-surface"
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
        <>
          <div class="apex-aside-tabs" role="group" aria-label={t("dock.panels")}>
            {groupOn("api") && (
              <button type="button" aria-pressed={panel === "api"} onClick={() => openAside("api")}>
                <Icon name="send" size={14} />
                {t("api.title")}
              </button>
            )}
            {groupOn("browser") && (
              <button
                type="button"
                aria-pressed={panel === "browser"}
                onClick={() => openAside("browser")}
              >
                <Icon name="globe" size={14} />
                {t("browser.open")}
              </button>
            )}
            <button
              type="button"
              class="apex-aside-close"
              title={t("aside.close")}
              aria-label={t("aside.close")}
              onClick={closeAside}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
          <Suspense fallback={<p class="p-3 text-faint">{t("dock.loading")}</p>}>
            {panel === "browser" ? <BrowserView /> : <ApiPanel />}
          </Suspense>
        </>
      ) : null}
    </SidePanel>
  );
}
