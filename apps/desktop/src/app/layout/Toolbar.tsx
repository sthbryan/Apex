import { Button } from "@apex/ui";
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
    <Button
      variant="subtle"
      size="sm"
      iconOnly
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <Icon name={icon} />
    </Button>
  );
}
