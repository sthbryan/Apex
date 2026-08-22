# apex-design

The design lab: runs ahead of `apps/desktop` with the same structure
(`src/app`, `src/features`, `src/shared/theme`), same assets
(@fontsource/inter, lucide-preact) and same stack (Preact + signals +
Tailwind v4), so approved pieces port to desktop nearly copy-paste.

    bun run dev:design     # http://localhost:5174

## Pages

- **Workspace** — the prototype as real components: pinned Home with its
  composer, split tab (ACP chat + TTY), browser/file/diff/race panes,
  dock panels (sessions, files, git with its sticky commit box, review,
  races…), statusbar pills, popovers (usage, resources, notifications,
  target, projects), race launcher.
- **Views** — every pane, overlay and dock panel at once.
- **Toolkit** — the component catalog, rendered from the registry.

## Tokens

Colors, spacing, radii and motion come from `packages/tokens`
(`@apex/tokens`), the single source of truth: one Rosé Pine palette
(Dawn in light, base in dark) with a crimson accent, veil translucency
and the Tailwind `@theme` bridge. The top-bar controls switch theme and veil
live. When a future web or mobile app needs the system, they consume
this package (mobile can generate platform formats from the same
values).

## Structure

    src/app/layout/Layout.tsx     titlebar · rail · dock · statusbar
    src/app/state.ts              signals (panels, tabs, overlays…)
    src/features/workspace/       tabs + panes + overlays
    src/features/workspace/Pops.tsx    statusbar popovers with their triggers
    src/features/workspace/fixtures.ts the mock data behind them
    src/features/dock/Panels.tsx  the 8 dock panels
    src/features/dock/fixtures.ts the mock data every panel renders
    src/features/toolkit/         the catalog page
    src/shared/theme/             mode.ts (signals) + components.css

Frozen HTML history of the prototypes lives in `docs/design/`
(v1 = the approved baseline, v2 = the iteration before this app).
