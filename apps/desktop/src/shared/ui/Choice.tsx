import cn from "cnfast";

type Props = {
  selected: boolean;
  onSelect: () => void;
  children: preact.ComponentChildren;
};

export function Choice({ selected, onSelect, children }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      class={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 transition active:scale-[0.97]",
        selected ? "bg-raised text-text" : "text-muted hover:text-text",
      )}
    >
      {children}
    </button>
  );
}
