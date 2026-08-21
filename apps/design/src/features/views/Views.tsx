import { Pill, SidePanel, Wordmark } from "@apex/ui";
import { DOCK_PANELS } from "@/features/dock/Panels";
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
          Dock panels
          <Pill>{DOCK_PANELS.length}</Pill>
        </h2>
        <p class="tk-blurb">What the rail switches between, at the real dock width.</p>
        <div class="vw-dock-grid">
          {DOCK_PANELS.map((p) => (
            <article class="vw-cell" key={p.id}>
              <span class="vw-label">{p.label}</span>
              <SidePanel class="vw-dock"><p.Component /></SidePanel>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
