export function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div class="flex items-baseline gap-3 border-b border-border pb-2 last:border-0">
      <dt class="min-w-0 flex-1 truncate text-muted">{term}</dt>
      <dd class="shrink-0 font-mono text-text tabular-nums">{value}</dd>
    </div>
  );
}
