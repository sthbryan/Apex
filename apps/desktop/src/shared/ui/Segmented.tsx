type Props = {
  label: string;
  children: preact.ComponentChildren;
};

export function Segmented({ label, children }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      class="flex items-center gap-0.5 rounded-lg border border-border bg-raised p-0.5"
    >
      {children}
    </div>
  );
}
