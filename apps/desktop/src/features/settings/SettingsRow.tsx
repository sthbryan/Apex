type Props = {
  label: string;
  hint: string;
  children: preact.ComponentChildren;
};

export function SettingsRow({ label, hint, children }: Props) {
  return (
    <div class="flex items-start gap-6 border-b border-border py-3.5 last:border-0">
      <div class="min-w-0 flex-1">
        <p class="text-text">{label}</p>
        <p class="mt-0.5 text-faint">{hint}</p>
      </div>
      <div class="shrink-0">{children}</div>
    </div>
  );
}
