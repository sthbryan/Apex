import cn from "cnfast";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { pacing, resetText, tone } from "@/features/usage/format";

type Props = {
  window: QuotaWindow;
};

export function UsageRow({ window }: Props) {
  const percent = Math.min(100, Math.max(0, window.used_percent));
  const level = tone(percent);
  const pace = pacing(window);

  return (
    <div class="flex items-center gap-2 py-0.5" title={resetText(window)}>
      <span class="w-6 shrink-0 text-faint">{window.label ?? "·"}</span>
      <span class={cn("w-9 shrink-0 text-right", level.text)}>{percent}%</span>

      <span class="relative h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-border">
        <span
          class={cn(
            "block h-full origin-left rounded-full transition-transform duration-500 ease-out",
            level.bar,
          )}
          style={{ transform: `scaleX(${percent / 100})` }}
        />
        {window.expected_percent !== null && (
          <span
            class="absolute top-0 h-full w-px bg-text/40"
            style={{ left: `${Math.min(100, Math.max(0, window.expected_percent))}%` }}
          />
        )}
      </span>

      <span class={cn("w-12 shrink-0 truncate text-right", pace?.tone ?? "")}>
        {pace?.text ?? ""}
      </span>
    </div>
  );
}
