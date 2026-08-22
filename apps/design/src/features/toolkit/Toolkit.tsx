import { REGISTRY } from "@apex/ui";
import type { ComponentLayer, ComponentMeta } from "@apex/ui";
import { Chip, Pill, Segmented, Switch, Wordmark } from "@apex/ui";
import { themeMode, veil } from "@/shared/theme/mode";
import type { ThemeMode } from "@/shared/theme/mode";
import { SAMPLES, TOKEN_GROUPS, TYPE_TOKENS } from "@/features/toolkit/tokens";
import { useTokenValues } from "@/features/toolkit/useTokenValues";
import type { TokenKind } from "@/features/toolkit/useTokenValues";
import { renderVariant } from "@/features/toolkit/harness";
import { COMPOSITIONS } from "@/features/toolkit/Compositions";

const LAYERS: { id: ComponentLayer; title: string; blurb: string }[] = [
  { id: "atom", title: "Atoms", blurb: "Indivisible primitives. They own no layout." },
  { id: "molecule", title: "Molecules", blurb: "Two or more atoms bound to one job." },
  { id: "organism", title: "Organisms", blurb: "Self-contained regions with their own behaviour." },
];

const ALL_TOKENS: Record<string, TokenKind> = {
  ...Object.fromEntries(
    TOKEN_GROUPS.flatMap((g) => g.tokens.map((t) => [t, g.kind === "color" ? "color" : "size"] as const)),
  ),
  ...Object.fromEntries(TYPE_TOKENS.map((t) => [t, "size"] as const)),
};

function roundPx(value?: string): string {
  if (!value?.endsWith("px")) return value ?? "";
  const n = Number.parseFloat(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)}px`;
}

function inkFor(hex?: string): string {
  if (!hex?.startsWith("#") || hex.length < 7) return "#fff";
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.55 ? "#191724" : "#fffaf3";
}

async function copyToken(token: string, light?: string, dark?: string): Promise<void> {
  const text = `var(${token}); /* ${light} / ${dark} */`;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Clipboard unavailable (e.g. insecure context); ignore.
  }
}

function flashCopied(el: EventTarget | null): void {
  if (!(el instanceof HTMLElement)) return;
  el.setAttribute("data-copied", "");
  window.setTimeout(() => el.removeAttribute("data-copied"), 900);
}

export function Toolkit() {
  const revision = `${themeMode.value}:${veil.value}`;
  const values = useTokenValues(ALL_TOKENS, revision);

  return (
    <div class="tk">
      <header class="tk-head">
        <div>
          <h1 class="tk-title"><Wordmark size="lg">Apex</Wordmark> UI</h1>
          <p class="tk-sub">
            {REGISTRY.length} components from <code>@apex/ui</code>, rendered live from the registry.
          </p>
        </div>
        <div class="tk-controls">
          <Segmented
            label="Theme"
            value={themeMode.value}
            onChange={(v) => themeMode.value = v as ThemeMode}
            options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]}
          />
          <label class="tk-veil">
            <span>Veil</span>
            <Switch label="Veil" checked={veil.value === "on"} onChange={(v) => veil.value = v ? "on" : "off"} />
          </label>
        </div>
      </header>

      <section class="tk-section">
        <h2 class="tk-h2">Tokens</h2>
        {TOKEN_GROUPS.filter((g) => g.kind === "color").map((group) => (
          <div class="tk-token-group" key={group.title}>
            <div class="tk-token-group-head">
              <h3 class="tk-h3">{group.title}</h3>
              <span class="tk-token-count">{group.tokens.length}</span>
              {group.note && <span class="tk-group-note">{group.note}</span>}
            </div>
            <div class="tk-palette" style={`--tk-segments:${group.tokens.length}`}>
              {group.tokens.map((token) => {
                const value = values[token];
                return (
                  <button
                    type="button"
                    class="tk-segment"
                    key={token}
                    title={`${token} · click to copy`}
                    style={`background:${value?.[themeMode.value]};color:${inkFor(value?.[themeMode.value])}`}
                    onClick={(e) => {
                      void copyToken(token, value?.light, value?.dark);
                      flashCopied(e.currentTarget);
                    }}
                  >
                    <span class="tk-segment-name">{token.replace("--apex-", "")}</span>
                    <span class="tk-segment-hex">{value?.[themeMode.value]}</span>
                    <span class="tk-copied">copied</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div class="tk-size-row">
          {TOKEN_GROUPS.filter((g) => g.kind === "size").map((group) => (
            <div class="tk-size-group" key={group.title}>
              <div class="tk-token-group-head">
                <h3 class="tk-h3">{group.title}</h3>
                <span class="tk-token-count">{group.tokens.length}</span>
              </div>
              {group.note && <p class="tk-group-note">{group.note}</p>}
              <table class="tk-table">
                <thead>
                  <tr>
                    <th class="tk-size-cell" />
                    <th>token</th>
                    <th>value</th>
                  </tr>
                </thead>
                <tbody>
                  {group.tokens.map((token) => (
                    <tr key={token}>
                      <td>
                        {token.includes("-h-") ? (
                          <span
                            class="tk-height"
                            style={`height:${values[token]?.light}`}
                            title={values[token]?.light}
                          />
                        ) : (
                          <span class="tk-radius" style={`border-radius:${values[token]?.light}`} />
                        )}
                      </td>
                      <td><code>{token.replace("--apex-", "")}</code></td>
                      <td class="tk-value">{roundPx(values[token]?.light)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">Type scale</h2>
        <p class="tk-blurb">Each step at its real size, with the token to reach for.</p>
        <div class="tk-specimen-card">
          {[...TYPE_TOKENS].reverse().map((token) => (
            <div class="tk-specimen" key={token}>
              <span class="tk-specimen-sample" style={`font-size:${values[token]?.light}`}>
                {SAMPLES[token]}
              </span>
              <span class="tk-specimen-meta">
                <code>{token.replace("--apex-text-", "")}</code>
                <span class="tk-value">{roundPx(values[token]?.light)}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">
          In situ
          <Pill>{COMPOSITIONS.length}</Pill>
        </h2>
        <p class="tk-blurb">The same components assembled the way the product uses them.</p>
        <div class="tk-compositions">
          {COMPOSITIONS.map((c) => (
            <article class="tk-component" key={c.name}>
              <header class="tk-component-head">
                <h3 class="tk-h3">{c.name}</h3>
              </header>
              <p class="tk-rule">{c.rule}</p>
              <div class="tk-composition">{c.render()}</div>
            </article>
          ))}
        </div>
      </section>

      {LAYERS.map((layer) => {
        const components = REGISTRY.filter((c) => c.layer === layer.id);
        return (
          <section class="tk-section" key={layer.id}>
            <h2 class="tk-h2">
              {layer.title}
              <Pill>{components.length}</Pill>
            </h2>
            <p class="tk-blurb">{layer.blurb}</p>
            <div class="tk-components">
              {components.map((meta) => <ComponentCard meta={meta} key={meta.name} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ComponentCard({ meta }: { meta: ComponentMeta }) {
  return (
    <article class="tk-component">
      <header class="tk-component-head">
        <h3 class="tk-h3">{meta.name}</h3>
        <Chip>{meta.variants.length} variants</Chip>
      </header>
      <p class="tk-blurb">{meta.description}</p>
      <p class="tk-rule">{meta.rule}</p>
      <div class="tk-variants">
        {meta.variants.map((variant) => (
          <div class="tk-variant" key={variant.name}>
            <div class="tk-stage">{renderVariant(meta.component, meta.name, variant)}</div>
            <span class="tk-variant-name">{variant.name}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
