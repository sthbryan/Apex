import cn from "cnfast";
import { Icon, type IconName } from "@/shared/ui/Icon";

type Props = {
  icon: IconName;
  label: string;
  percent: number;
  detail?: string;
};

export function Meter({ icon, label, percent, detail }: Props) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div class="flex items-center gap-2 py-0.5" title={label}>
      <Icon name={icon} class="shrink-0 text-muted" />
      <span class="w-20 shrink-0 text-muted">{label}</span>
      <span class={cn("w-9 shrink-0 text-right", toneText(clamped))}>{clamped.toFixed(0)}%</span>
      <span class="h-1 flex-1 overflow-hidden rounded-full bg-border">
        <span
          class={cn(
            "block h-full origin-left rounded-full transition-transform duration-500 ease-out",
            toneBar(clamped),
          )}
          style={{ transform: `scaleX(${clamped / 100})` }}
        />
      </span>
      <span class="w-18 shrink-0 truncate text-right text-faint">{detail ?? ""}</span>
    </div>
  );
}

function toneBar(percent: number): string {
  if (percent >= 90) {
    return "bg-state-failed";
  }
  if (percent >= 70) {
    return "bg-state-blocked";
  }
  return "bg-state-working";
}

function toneText(percent: number): string {
  return percent >= 90 ? "text-state-failed" : "text-muted";
}
