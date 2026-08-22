import { Pill, SidePanel, Wordmark } from "@apex/ui";
import { DOCK_PANELS } from "@/features/dock/Panels";
import { Carousel } from "@/features/views/Carousel";
import { OVERLAYS } from "@/features/views/Overlays";
import { PANE_TYPES } from "@/features/workspace/Workspace";

export function Views() {
  return (
    <div class="tk">
      <header class="tk-head">
        <div>
          <h1 class="tk-title"><Wordmark size="lg">Apex</Wordmark> views</h1>
          <p class="tk-sub">
            Every view that can fill a pane, and every panel that can fill the dock — all at once.
          </p>
        </div>
      </header>

      <section class="tk-section">
        <h2 class="tk-h2">
          Views
          <Pill>{PANE_TYPES.length}</Pill>
        </h2>
        <p class="tk-blurb">What a workspace tab renders. One subject per view.</p>
        <div class="vw-grid">
          {PANE_TYPES.map((v) => (
            <article class="vw-cell" key={v.id}>
              <span class="vw-label">{v.label}</span>
              <div class="vw-stage vw-stage-wide"><v.Component /></div>
            </article>
          ))}
        </div>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">
          Overlays
          <Pill>{OVERLAYS.length}</Pill>
        </h2>
        <p class="tk-blurb">Everything that floats above a view. Popovers anchor to the status bar; overlays take the window.</p>
        <div class="vw-overlay-grid">
          {OVERLAYS.map((o) => (
            <article class="vw-cell" key={o.id}>
              <span class="vw-label">{o.label} · {o.kind}</span>
              <div class="vw-overlay-stage"><o.Component /></div>
            </article>
          ))}
        </div>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">
          Dock panels
          <Pill>{DOCK_PANELS.length}</Pill>
        </h2>
        <p class="tk-blurb">What the rail switches between, at the real dock width.</p>
        <Carousel label="Dock panels">
          {DOCK_PANELS.map((p) => (
            <article class="vw-cell" key={p.id}>
              <span class="vw-label">{p.label}</span>
              <SidePanel class="vw-dock"><p.Component /></SidePanel>
            </article>
          ))}
        </Carousel>
      </section>
    </div>
  );
}
