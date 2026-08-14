import { dockPanelAt, popPanelToTab } from "@/app/layout/actions";
import { DOCK_PANELS } from "@/app/layout/panels";
import { type DockPanel, dockOrder, moveDockPanel } from "@/app/layout/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function DockOrder() {
  const order = dockOrder.value;
  const docked = new Set(order);
  const popped = (Object.keys(DOCK_PANELS) as DockPanel[]).filter((id) => !docked.has(id));

  return (
    <div class="flex w-64 flex-col gap-1">
      <ol class="flex flex-col gap-0.5">
        {order.map((id, index) => (
          <li key={id} class="flex items-center gap-1">
            <Icon name={DOCK_PANELS[id].icon} class="text-faint" />
            <span class="min-w-0 flex-1 truncate text-text">{DOCK_PANELS[id].label()}</span>
            <button
              type="button"
              title={t("settings.sidebarUp")}
              disabled={index === 0}
              onClick={() => moveDockPanel(id, -1)}
              class="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text disabled:opacity-30"
            >
              <Icon name="chevron" class="rotate-180" />
            </button>
            <button
              type="button"
              title={t("settings.sidebarDown")}
              disabled={index === order.length - 1}
              onClick={() => moveDockPanel(id, 1)}
              class="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text disabled:opacity-30"
            >
              <Icon name="chevron" />
            </button>
            <button
              type="button"
              title={t("dock.popOut")}
              onClick={() => popPanelToTab(id)}
              class="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
            >
              <Icon name="external" />
            </button>
          </li>
        ))}
      </ol>

      {popped.map((id) => (
        <div key={id} class="flex items-center gap-1 text-faint">
          <Icon name={DOCK_PANELS[id].icon} />
          <span class="min-w-0 flex-1 truncate">{DOCK_PANELS[id].label()}</span>
          <span class="text-micro">{t("settings.sidebarTab")}</span>
          <button
            type="button"
            title={t("dock.popIn")}
            onClick={() => dockPanelAt(id)}
            class="flex size-6 items-center justify-center rounded transition-colors hover:bg-raised hover:text-text"
          >
            <Icon name="panel" />
          </button>
        </div>
      ))}
    </div>
  );
}
