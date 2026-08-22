import { Button, Pill, SidePanel, Wordmark } from "@apex/ui";
import { useState } from "preact/hooks";
import { Maximize2 } from "lucide-preact";
import { DOCK_PANELS } from "@/features/dock/Panels";
import { Carousel } from "@/features/views/Carousel";
import { OVERLAYS } from "@/features/views/Overlays";
import type { Overlay } from "@/features/views/Overlays";
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
        <Carousel label="Views" width={560} perPage={1}>
          {PANE_TYPES.map((v) => (
            <article class="vw-cell" key={v.id}>
              <span class="vw-label">{v.label}</span>
              <div class="vw-stage"><v.Component /></div>
            </article>
          ))}
        </Carousel>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">
          Overlays
          <Pill>{OVERLAYS.length}</Pill>
        </h2>
        <p class="tk-blurb">Everything that floats above a view. Popovers anchor to the status bar; overlays take the window.</p>
        <Carousel label="Overlays" width={520} perPage={1}>
          {OVERLAYS.map((o) => <OverlayCard overlay={o} key={o.id} />)}
        </Carousel>
      </section>

      <section class="tk-section">
        <h2 class="tk-h2">
          Dock panels
          <Pill>{DOCK_PANELS.length}</Pill>
        </h2>
        <p class="tk-blurb">What the rail switches between, at the real dock width.</p>
        <Carousel label="Dock panels" width={240} perPage={2}>
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

function OverlayCard({ overlay }: { overlay: Overlay }) {
  const [open, setOpen] = useState(false);
  return (
    <article class="vw-cell">
      <span class="vw-label">
        {overlay.label} · {overlay.kind}
        {overlay.Live ? (
          <Button variant="subtle" size="xs" class="ml-auto" onClick={() => setOpen(true)}>
            <Maximize2 size={11} />Open for real
          </Button>
        ) : null}
      </span>
      <div class="vw-overlay-stage"><overlay.Component /></div>
      {overlay.Live ? <overlay.Live open={open} onClose={() => setOpen(false)} /> : null}
    </article>
  );
}
