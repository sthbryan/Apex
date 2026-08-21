import { veil } from "@/shared/theme/mode";
import { navigate, route } from "@/app/router";
import type { Route } from "@/app/router";
import { Layout } from "@/app/layout/Layout";
import { Workspace } from "@/features/workspace/Workspace";
import { Toolkit } from "@/features/toolkit/Toolkit";

const PAGES: { to: Route; label: string }[] = [
  { to: "/", label: "workspace" },
  { to: "/toolkit", label: "toolkit" },
];

export function App() {
  return (
    <div class="apx">
      {route.value === "/toolkit" ? <Toolkit /> : (
        <div class="window chrome-blur" data-veil={veil.value}>
          <Layout>
            <Workspace />
          </Layout>
        </div>
      )}

      <nav class="stage-links" aria-label="Lab pages">
        {PAGES.map((p) => (
          <a
            key={p.to}
            href={p.to}
            aria-current={route.value === p.to ? "page" : undefined}
            onClick={(e) => { e.preventDefault(); navigate(p.to); }}
          >
            {p.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
