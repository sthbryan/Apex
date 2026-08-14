import { useEffect, useRef } from "preact/hooks";

import { Icon, type IconName } from "../components/Icon";
import { usePresence } from "../components/presence";
import { t } from "../i18n";
import { metrics } from "../metrics";
import { UsagePopover } from "./UsagePopover";
import { toggleSettings } from "./Settings";
import { anyOverPace, tightestUsage, toggleUsagePopover, usageOpen } from "./usageState";
import { cn } from "cnfast";

type Props = {
  onNewSession: () => void;
  status: string;
};

export function Toolbar({ onNewSession, status }: Props) {
  const holder = useRef<HTMLDivElement>(null);
  const popover = usePresence<HTMLDivElement>(usageOpen.value);

  useEffect(() => {
    if (!usageOpen.value) {
      return;
    }
    const dismiss = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) {
        usageOpen.value = false;
      }
    };
    window.addEventListener("mousedown", dismiss);
    return () => window.removeEventListener("mousedown", dismiss);
  }, [usageOpen.value]);

  return (
    <div class="flex items-center gap-1">
      <span class="mr-2 text-faint">{status}</span>

      {tightestUsage.value !== null && (
        <div ref={holder} class="relative">
          <button
            type="button"
            title={t("usage.title")}
            onClick={toggleUsagePopover}
            class={cn("flex h-6 items-center rounded px-1.5 transition-colors hover:bg-raised", usageTone())}
          >
            {anyOverPace.value && <Icon name="activity" class="mr-1 animate-breathe" />}
            {tightestUsage.value}%
          </button>

          {popover.mounted && (
            <div
              ref={popover.holder}
              class={cn("absolute right-0 top-full z-50 mt-1 origin-top-right", {
                "animate-drop-out": popover.leaving,
                "animate-drop-in": !popover.leaving,
              })}
            >
              <UsagePopover
                reports={metrics.value?.quotas ?? []}
                onClose={() => {
                  usageOpen.value = false;
                }}
              />
            </div>
          )}
        </div>
      )}

      <ToolbarButton label={t("toolbar.newSession")} icon="plus" onClick={onNewSession} />
      <ToolbarButton label={t("settings.title")} icon="settings" onClick={toggleSettings} />
    </div>
  );
}

function usageTone(): string {
  const percent = tightestUsage.value ?? 0;
  if (percent >= 90 || anyOverPace.value) {
    return "text-state-blocked";
  }
  return "text-faint hover:text-text";
}

function ToolbarButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      class="flex size-6 items-center justify-center rounded text-faint transition hover:bg-raised hover:text-text active:scale-90"
    >
      <Icon name={icon} />
    </button>
  );
}
