import { Icon, type IconName } from "@/shared/ui/Icon";

type Props = {
  icon: IconName;
  value: string;
};

export function Gauge({ icon, value }: Props) {
  return (
    <span class="flex items-center gap-1">
      <Icon name={icon} size={12} />
      <span class="tabular-nums">{value}</span>
    </span>
  );
}
