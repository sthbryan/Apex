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

export function Toolkit() {
  const values = useTokenValues(ALL_TOKENS);

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
        <div class="tk-token-groups">
          {TOKEN_GROUPS.map((group) => (
            <div class="tk-token-group" key={group.title}>
              <h3 class="tk-h3">{group.title}</h3>
              <table class="tk-table">
                <thead>
                  <tr>
                    <th />
                    <th>token</th>
                    <th>light</th>
                    <th>dark</th>
                  </tr>
                </thead>
                <tbody>
                  {group.tokens.map((token) => {
                    const value = values[token];
                    return (
                      <tr key={token}>
                        <td>
                          {group.kind === "color" ? (
                            <span
                              class="tk-swatch"
                              style={`background:linear-gradient(90deg, ${value?.light} 50%, ${value?.dark} 50%)`}
                            />
                          ) : (
                            <span class="tk-radius" style={`border-radius:${value?.light}`} />
                          )}
                        </td>
                        <td><code>{token.replace("--apex-", "")}</code></td>
                        <td class="tk-value">{value?.light}</td>
                        <td class="tk-value">{value?.dark}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">Type scale</h2>
        <div class="tk-type">
          {[...TYPE_TOKENS].reverse().map((token) => (
            <div class="tk-type-row" key={token}>
              <span class="tk-type-sample" style={`font-size:${values[token]?.light}`}>
                {SAMPLES[token]}
              </span>
              <span class="tk-value">
                {token.replace("--apex-text-", "")} · {values[token]?.light}
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
