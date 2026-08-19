type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
};

export function Slider({ label, value, min, max, step = 1, format, onChange }: Props) {
  return (
    <div class="flex items-center gap-2">
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(event) => onChange(Number(event.currentTarget.value))}
        class="w-36 cursor-pointer accent-accent outline-none"
      />
      <span class="w-12 shrink-0 text-right text-muted tabular-nums">{format(value)}</span>
    </div>
  );
}
