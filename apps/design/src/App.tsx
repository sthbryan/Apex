import { Columns3, LayoutGrid, SwatchBook } from "lucide-preact";
import { AppWindow } from "@apex/ui";
import { navigate, route } from "@/app/router";
import type { Route } from "@/app/router";
import { Layout } from "@/app/layout/Layout";
import { Workspace } from "@/features/workspace/Workspace";
import { Toolkit } from "@/features/toolkit/Toolkit";
import { Views } from "@/features/views/Views";

const PAGES: { to: Route; label: string; Icon: typeof LayoutGrid }[] = [
  { to: "/", label: "Workspace", Icon: LayoutGrid },
  { to: "/views", label: "Views", Icon: Columns3 },
  { to: "/toolkit", label: "Toolkit", Icon: SwatchBook },
];

export function App() {
  return (
    <div class="apx">
      {route.value === "/toolkit" ? <Toolkit /> : route.value === "/views" ? <Views /> : (
        <AppWindow class="window">
          <Layout>
            <Workspace />
          </Layout>
        </AppWindow>
      )}

      <nav class="stage-links" aria-label="Lab pages">
        {PAGES.map((p) => (
          <a
            key={p.to}
            href={p.to}
            aria-current={route.value === p.to ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); navigate(p.to); }}
          >
            <p.Icon size={13} /><span>{p.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
