import { Icon, type IconName } from "@/shared/ui/Icon";

type Props = {
  icon: IconName;
  label: string;
  value: string;
};

export function Gauge({ icon, label, value }: Props) {
  return (
    <span class="flex items-center gap-1" title={label}>
      <Icon name={icon} size={12} />
      {value}
    </span>
  );
}
