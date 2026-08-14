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
