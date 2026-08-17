import { Icon } from "@/shared/ui/Icon";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  value: string;
  options: Option[];
  onSelect: (value: string) => void;
  label: string;
};

export function Select({ value, options, onSelect, label }: Props) {
  return (
    <div class="relative flex items-center rounded border border-border bg-overlay transition-colors hover:border-muted">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onSelect(event.currentTarget.value)}
        class="appearance-none bg-transparent py-1 pr-7 pl-2 text-text outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevron" size={12} class="pointer-events-none absolute right-2 text-faint" />
    </div>
  );
}
