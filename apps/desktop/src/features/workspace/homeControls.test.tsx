import { act } from "preact/test-utils";
import { beforeEach, expect, it } from "vitest";
import { activeProjectId, projects } from "@/features/projects/state";
import { agentModes, disabledAgents, lastAgent } from "@/features/settings/agentMode";
import { Home } from "@/features/workspace/Home";
import { agents } from "@/shared/daemon";
import { render } from "@/test/render";

beforeEach(() => {
  projects.value = [{ id: "test", name: "Apex", root: "/tmp/apex", is_git: true }];
  activeProjectId.value = "test";
  disabledAgents.value = [];
  agentModes.value = {};
  lastAgent.value = "codex";
  agents.value = ["codex", "opencode"].map((name) => ({
    name,
    command: name,
    resolved_path: `/bin/${name}`,
    mode: "acp",
    agentic: true,
    supports_resume: true,
    speaks_acp: true,
    speaks_pty: true,
    shares_config: false,
    mcp_blocked: false,
    mcp_hint: null,
  }));
});

it("keeps single-agent selection and isolation while exposing race selection", () => {
  const { container } = render(<Home />);
  expect(container.querySelector(".ui-select-trigger")).not.toBeNull();
  const checks = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  expect(checks).toHaveLength(2);
  act(() => checks[1].click());
  expect(checks[1].checked).toBe(true);
  act(() => checks[0].click());
  expect(container.querySelector(".ui-select-trigger")).toBeNull();
  expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
  expect(container.querySelectorAll("[aria-pressed]")).toHaveLength(2);
  act(() => checks[0].click());
  expect(container.querySelector(".ui-select-trigger")).not.toBeNull();
});
