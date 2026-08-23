import { Meter } from "@apex/ui";
import type { QuotaWindow } from "@/bindings/QuotaWindow";
import { barTone } from "@/features/resources/tone";
import { pacing, resetIn, resetText } from "@/features/usage/format";

type Props = {
  window: QuotaWindow;
};

export function UsageRow({ window }: Props) {
  const percent = Math.min(100, Math.max(0, window.used_percent));
  const pace = pacing(window);
  const away = pace ? null : resetIn(window);

  return (
    <Meter
      title={resetText(window)}
      label={window.label ?? "\u00b7"}
      value={percent}
      tone={barTone(percent)}
      tick={window.expected_percent ?? undefined}
      display={`${percent}%`}
      detail={<span class={pace?.tone ?? "text-faint"}>{pace?.text ?? away ?? ""}</span>}
    />
  );
}
