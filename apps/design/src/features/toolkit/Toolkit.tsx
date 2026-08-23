import { REGISTRY } from "@apex/ui";
import type { ComponentLayer, ComponentMeta } from "@apex/ui";
import { Button, Chip, Pill, Segmented, Switch, Wordmark } from "@apex/ui";
import { useState } from "preact/hooks";
import { Play } from "lucide-preact";
import { themeMode, veil } from "@/shared/theme/mode";
import type { ThemeMode } from "@/shared/theme/mode";
import {
  DURATIONS, EASINGS, GIT_ALIASES, SAMPLES, SHADOWS, SIZE_EXTRA, SIZE_GROUPS, TOKEN_GROUPS,
  TYPE_AXES, TYPE_TOKENS, Z_TOKENS,
} from "@/features/toolkit/tokens";
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
  ...Object.fromEntries(GIT_ALIASES.map((a) => [a.token, "color"] as const)),
  ...Object.fromEntries(SIZE_EXTRA.flatMap((g) => g.tokens.map((t) => [t, "size"] as const))),
  ...Object.fromEntries([...DURATIONS, ...EASINGS, ...SHADOWS, ...Z_TOKENS].map((t) => [t, "raw"] as const)),
  ...Object.fromEntries(TYPE_AXES.flatMap((a) => a.tokens.map((t) => [t, "raw"] as const))),
};

const short = (token: string): string => token.replace("--apex-", "");

function padZero(value?: string): string {
  return value ? value.replace(/^(-?)\./, "$10.") : "";
}

function formatMs(value?: string): string {
  if (!value) return "";
  const n = Number.parseFloat(value);
  if (Number.isNaN(n)) return value;
  return `${value.trim().endsWith("ms") ? n : n * 1000}ms`;
}

function curvePath(value?: string): string {
  const nums = value?.match(/-?\d*\.?\d+/g)?.map(Number);
  if (!nums || nums.length < 4) return "";
  const [x1, y1, x2, y2] = nums;
  const p = (x: number, y: number) => `${(x * 44).toFixed(1)},${((1 - y) * 44).toFixed(1)}`;
  return `M0,44 C${p(x1, y1)} ${p(x2, y2)} 44,0`;
}

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
  const [run, setRun] = useState(false);
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
                    <span class="tk-segment-name">{short(token)}</span>
                    <span class="tk-segment-hex">{value?.[themeMode.value]}</span>
                    <span class="tk-copied">copied</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div class="tk-token-group">
          <div class="tk-token-group-head">
            <h3 class="tk-h3">Aliases</h3>
            <span class="tk-token-count">{GIT_ALIASES.length}</span>
            <span class="tk-group-note">Names, not colours. Each one points at a token above.</span>
          </div>
          <div class="tk-aliases">
            {GIT_ALIASES.map((alias) => (
              <button
                type="button"
                class="tk-alias"
                key={alias.token}
                title={`${alias.token} · click to copy`}
                onClick={(e) => {
                  const value = values[alias.token];
                  void copyToken(alias.token, value?.light, value?.dark);
                  flashCopied(e.currentTarget);
                }}
              >
                <span class="tk-alias-dot" style={`background:${values[alias.token]?.[themeMode.value]}`} />
                <code>{short(alias.token)}</code>
                <span class="tk-alias-arrow">→</span>
                <code class="tk-alias-target">{short(alias.target)}</code>
                <span class="tk-copied">copied</span>
              </button>
            ))}
          </div>
        </div>

        <div class="tk-size-row">
          {SIZE_GROUPS.map((group) => (
            <div class="tk-size-group" key={group.title}>
              <div class="tk-token-group-head">
                <h3 class="tk-h3">{group.title}</h3>
                <span class="tk-token-count">{group.tokens.length}</span>
              </div>
              {group.note && <p class="tk-group-note">{group.note}</p>}
              <table class="tk-table">
                <thead>
                  <tr>
                    {group.swatch === "none" ? null : <th class="tk-size-cell" />}
                    <th>token</th>
                    <th>value</th>
                  </tr>
                </thead>
                <tbody>
                  {group.tokens.map((token) => (
                    <tr key={token}>
                      {group.swatch === "none" ? null : (
                        <td>
                          {group.swatch === "height" ? (
                            <span class="tk-height" style={`height:${values[token]?.light}`} />
                          ) : group.swatch === "bar" ? (
                            <span class="tk-bar" style={`width:${values[token]?.light}`} />
                          ) : (
                            <span class="tk-radius" style={`border-radius:${values[token]?.light}`} />
                          )}
                        </td>
                      )}
                      <td><code>{short(token)}</code></td>
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
        <h2 class="tk-h2">
          Motion
          <span class="tk-token-count">{DURATIONS.length + EASINGS.length}</span>
          <Button variant="subtle" size="sm" class="ml-auto" onClick={() => setRun(!run)}>
            <Play size={12} />Play
          </Button>
        </h2>
        <p class="tk-blurb">Durations race at the same distance; curves race at the same duration.</p>
        <div class="tk-spec-row" data-run={run ? "on" : undefined}>
          <div class="tk-size-group">
            <div class="tk-token-group-head">
              <h3 class="tk-h3">Durations</h3>
              <span class="tk-token-count">{DURATIONS.length}</span>
            </div>
            {DURATIONS.map((token) => (
              <div class="tk-motion" key={token} title={`${token}: ${values[token]?.light}`}>
                <code>{short(token)}</code>
                <span class="tk-track">
                  <span class="tk-dot" style={`--tk-dur:${values[token]?.light}`} />
                </span>
                <span class="tk-value">{formatMs(values[token]?.light)}</span>
              </div>
            ))}
          </div>
          <div class="tk-size-group">
            <div class="tk-token-group-head">
              <h3 class="tk-h3">Curves</h3>
              <span class="tk-token-count">{EASINGS.length}</span>
            </div>
            {EASINGS.map((token) => (
              <div class="tk-motion" key={token} title={`${token}: ${values[token]?.light}`}>
                <svg class="tk-curve" width="30" height="42" viewBox="-4 -24 52 72" aria-hidden="true">
                  <line x1="0" y1="44" x2="44" y2="44" />
                  <line x1="0" y1="0" x2="44" y2="0" />
                  <path d={curvePath(values[token]?.light)} />
                </svg>
                <code>{short(token)}</code>
                <span class="tk-track">
                  <span class="tk-dot" style={`--tk-ease:${values[token]?.light}`} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">
          Elevation
          <span class="tk-token-count">{SHADOWS.length + Z_TOKENS.length}</span>
        </h2>
        <p class="tk-blurb">
          Shadows lift a surface off the page; the depth scale decides what covers what.
        </p>
        <div class="tk-spec-row">
          <div class="tk-size-group">
            <div class="tk-token-group-head">
              <h3 class="tk-h3">Shadows</h3>
              <span class="tk-token-count">{SHADOWS.length}</span>
            </div>
            <table class="tk-table">
              <thead>
                <tr>
                  <th class="tk-size-cell" />
                  <th>token</th>
                  <th>value</th>
                </tr>
              </thead>
              <tbody>
                {SHADOWS.map((token) => (
                  <tr key={token}>
                    <td>
                      <span class="tk-shadow-tile" style={`box-shadow:${values[token]?.light}`} />
                    </td>
                    <td><code>{short(token)}</code></td>
                    <td class="tk-value">{values[token]?.light}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div class="tk-size-group">
            <div class="tk-token-group-head">
              <h3 class="tk-h3">Depth</h3>
              <span class="tk-token-count">{Z_TOKENS.length}</span>
            </div>
            <p class="tk-group-note">Painted back to front, so only the z value decides the order.</p>
            <div class="tk-z-stack">
              {Z_TOKENS.map((token, i) => ({ token, i })).reverse().map(({ token, i }) => (
                <span
                  class="tk-z"
                  key={token}
                  style={`z-index:${values[token]?.light};--tk-i:${i}`}
                >
                  <code>{short(token).replace("z-", "")}</code>
                  <span class="tk-value">{values[token]?.light}</span>
                </span>
              ))}
            </div>
          </div>
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

        <div class="tk-spec-row">
          {TYPE_AXES.map((axis) => (
            <div class="tk-size-group" key={axis.title}>
              <div class="tk-token-group-head">
                <h3 class="tk-h3">{axis.title}</h3>
                <span class="tk-token-count">{axis.tokens.length}</span>
              </div>
              {axis.tokens.map((token) => (
                <div class="tk-axis" key={token}>
                  <span class="tk-axis-sample" style={`${axis.property}:${values[token]?.light}`}>
                    {axis.sample}
                  </span>
                  <span class="tk-specimen-meta">
                    <code>{short(token).replace(/^(weight|tracking|leading)-/, "")}</code>
                    <span class="tk-value">{padZero(values[token]?.light)}</span>
                  </span>
                </div>
              ))}
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
