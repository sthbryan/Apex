import cn from "cnfast";
import type { ComponentChildren } from "preact";
import { Icon, type IconName } from "@/shared/ui/Icon";

export function Toolbar({ status, children }: { status: string; children?: ComponentChildren }) {
  return (
    <div class="flex items-center gap-1">
      <span class="mr-2 text-faint">{status}</span>
      {children}
    </div>
  );
}

export function ToolbarButton({
  label,
  icon,
  onClick,
  pressed,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      class={cn(
        "flex size-6 items-center justify-center rounded transition hover:bg-raised hover:text-text active:scale-90",
        pressed ? "text-text" : "text-faint",
      )}
    >
      <Icon name={icon} />
    </button>
  );
}
