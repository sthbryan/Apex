import { useEffect, useState } from "preact/hooks";
import { themeMode, veil } from "@/shared/theme/mode";
import { page } from "@/app/state";
import { Layout } from "@/app/layout/Layout";
import { Workspace } from "@/features/workspace/Workspace";
import { Toolkit } from "@/features/toolkit/Toolkit";

function Group({ ids, labels, value, set }: {
  ids: string[]; labels: string[]; value: string; set: (v: string) => void;
}) {
  return (
    <div class="group">
      {ids.map((id, i) => (
        <button aria-pressed={id === value} onClick={() => set(id)}>{labels[i]}</button>
      ))}
    </div>
  );
}

export function App() {
  // mirror the signal in local state so page switches never depend on
  // the signals render adapter being wired in this bundle
  const [pg, setPg] = useState(page.value);
  useEffect(() => page.subscribe((v) => setPg(v)), []);

  return (
    <div class="apx">
      <div class="stage-controls">
        <div class="version-tabs">
          <button class={pg === "workspace" ? "on" : ""} onClick={() => (page.value = "workspace")}>Workspace</button>
          <button class={pg === "toolkit" ? "on" : ""} onClick={() => (page.value = "toolkit")}>Toolkit</button>
        </div>
        <span>Theme</span>
        <Group
          ids={["light", "dark"]} labels={["Light", "Dark"]}
          value={themeMode.value} set={(v) => (themeMode.value = v)}
        />
        <Group
          ids={["off", "on"]} labels={["Solid", "Veil"]}
          value={veil.value} set={(v) => (veil.value = v)}
        />
      </div>

      {pg === "toolkit" ? <Toolkit /> : (
        <div class="window chrome-blur" data-veil={veil.value}>
          <Layout>
            <Workspace />
          </Layout>
        </div>
      )}
    </div>
  );
}
