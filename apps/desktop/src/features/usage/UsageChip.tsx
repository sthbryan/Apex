import { cn } from "cnfast";
import { useEffect, useRef } from "preact/hooks";
import { anyOverPace, tightestUsage, toggleUsagePopover, usageOpen } from "@/features/usage/state";
import { UsagePopover } from "@/features/usage/UsagePopover";
import { t } from "@/shared/i18n";
import { metrics } from "@/shared/telemetry";
import { Icon } from "@/shared/ui/Icon";
import { usePresence } from "@/shared/ui/presence";

export function UsageChip() {
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

  if (tightestUsage.value === null) {
    return null;
  }

  return (
    <div ref={holder} class="relative">
      <button
        type="button"
        title={t("usage.title")}
        onClick={toggleUsagePopover}
        class={cn(
          "flex h-6 items-center rounded px-1.5 transition-colors hover:bg-raised text-xs",
          tone(),
        )}
      >
        {anyOverPace.value && <Icon size={11} name="activity" class="mr-1 animate-breathe" />}
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
            failures={metrics.value?.quota_failures ?? []}
            onClose={() => {
              usageOpen.value = false;
            }}
          />
        </div>
      )}
    </div>
  );
}

function tone(): string {
  const percent = tightestUsage.value ?? 0;
  if (percent >= 90 || anyOverPace.value) {
    return "text-state-blocked";
  }
  return "text-faint hover:text-text";
}
