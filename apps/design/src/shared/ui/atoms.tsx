import type { ComponentChildren, JSX } from "preact";
import { AgentIcon } from "@/shared/ui/AgentIcon";

export function Glyph({ agent, mini }: { agent: string; mini?: boolean }) {
  return <AgentIcon agent={agent} size={mini ? 16 : 22} />;
}

export function Dot({ state }: { state: string }) {
  return <span class={`dot ${state}`} />;
}

export function StatePill({ state, children }: { state: string; children: ComponentChildren }) {
  return (
    <span class={`state-pill ${state}`} style="margin-left:auto">
      <i />{children}
    </span>
  );
}

export function Btn({ kind = "ghost", children, ...rest }: { kind?: "ghost" | "primary" } & JSX.HTMLAttributes<HTMLButtonElement>) {
  return <button class={`btn btn-${kind}`} {...rest}>{children}</button>;
}

export function Seg({ options, value, onChange }: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div class="seg" role="group">
      {options.map((o) => (
        <button aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label class="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <i />
    </label>
  );
}

export function Bar({ tone, width }: { tone?: string; width: string }) {
  return <div class="bar"><i class={tone} style={`width:${width}`} /></div>;
}
