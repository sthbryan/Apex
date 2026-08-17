import cn from "cnfast";

type Props = {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title?: string;
  children: preact.ComponentChildren;
};

export function Choice({ selected, onSelect, disabled, title, children }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      title={title}
      onClick={onSelect}
      class={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition enabled:active:scale-[0.97]",
        selected
          ? "bg-overlay text-text shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
          : "text-muted enabled:hover:text-text",
        disabled ? "cursor-not-allowed opacity-40" : "",
      )}
    >
      {children}
    </button>
  );
}
