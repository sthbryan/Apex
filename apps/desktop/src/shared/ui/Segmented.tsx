type Props = {
  children: preact.ComponentChildren;
};

export function Segmented({ children }: Props) {
  return (
    <div class="flex items-center gap-0.5 rounded-lg border border-border p-0.5">{children}</div>
  );
}
