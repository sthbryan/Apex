# apex-design

The design lab: runs ahead of `apps/desktop` with the same structure
(`src/app`, `src/features`, `src/shared/{theme,ui}`), same assets
(@fontsource/inter, lucide-preact) and same stack (Preact + signals +
Tailwind v4), so approved pieces port to desktop nearly copy-paste.

    bun run dev:design     # http://localhost:5174

## Pages

- **Workspace** — the v2 prototype as real components: welcome composer,
  split tab (ACP chat + TTY), browser/file/diff/race panes, dock panels
  (summary, git with sticky commit, review, races…), statusbar pills,
  popovers (usage, resources, notifications, target, projects), race
  launcher.
- **Toolkit** — the component and pane-type catalog.

## Tokens

Colors, radii and motion come from `packages/tokens`
(`@apex/tokens`), the single source of truth. It ships the
**current** palette (mirrors `apps/desktop` tokens.css) and the
**proposal** (warm graphite/paper) behind `data-palette="proposal"`,
plus veil translucency and the Tailwind `@theme` bridge. The top-bar
controls switch palette/theme/veil live. When a future web or mobile
app needs the system, they consume this package (mobile can generate
platform formats from the same values).

## Structure

    src/app/layout/Layout.tsx     titlebar · rail · dock · statusbar
    src/app/state.ts              signals (panels, tabs, overlays…)
    src/features/workspace/       tabs + panes + overlays
    src/features/dock/Panels.tsx  the 9 dock panels
    src/features/toolkit/         the catalog page
    src/shared/theme/             mode.ts (signals) + components.css
    src/shared/ui/atoms.tsx       Glyph, Dot, StatePill, Btn, Seg…

Frozen HTML history of the prototypes lives in `docs/design/`
(v1 = the approved baseline, v2 = the iteration before this app).
