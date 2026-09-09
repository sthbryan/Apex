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
  expect(container.querySelector(".ui-select-trigger")).toBeNull();
  const selected = () =>
    Array.from(container.querySelectorAll('.ui-toggle-chip[aria-pressed="true"]')).map((button) =>
      button.getAttribute("title"),
    );
  const agent = (name: string) => {
    const button = container.querySelector<HTMLButtonElement>(`button[title="${name}"]`);
    if (!button) throw new Error(`Missing agent button: ${name}`);
    return button;
  };
  expect(selected()).toEqual(["codex"]);
  act(() => agent("opencode").click());
  expect(selected()).toEqual(["opencode"]);
  const checks = container.querySelectorAll<HTMLButtonElement>(".home-option");
  expect(checks).toHaveLength(2);
  act(() => checks[1].click());
  expect(checks[1].getAttribute("aria-pressed")).toBe("true");
  act(() => checks[0].click());
  expect(container.querySelector(".ui-select-trigger")).toBeNull();
  expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  expect(checks[1].disabled).toBe(true);
  expect(checks[1].getAttribute("aria-pressed")).toBe("true");
  act(() => agent("codex").click());
  expect(selected()).toEqual(["codex", "opencode"]);
  act(() => agent("opencode").click());
  expect(selected()).toEqual(["codex"]);
  act(() => agent("opencode").click());
  act(() => checks[0].click());
  expect(selected()).toEqual(["codex"]);
  expect(checks[1].getAttribute("aria-pressed")).toBe("true");
  expect(checks[1].disabled).toBe(false);
});
