import { act } from "preact/test-utils";
import { beforeEach, expect, it, vi } from "vitest";
import { activeProjectId, projects } from "@/features/projects/state";
import { startSession } from "@/features/sessions/pending";
import { agentModes, disabledAgents, lastAgent } from "@/features/settings/agentMode";
import { Home } from "@/features/workspace/Home";
import { agents } from "@/shared/daemon";
import { render } from "@/test/render";

vi.mock("@/features/sessions/pending", () => ({ startSession: vi.fn() }));

beforeEach(() => {
  vi.mocked(startSession).mockReset();
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

it("shows pending startup, prevents duplicate requests and retains the task after failure", async () => {
  let fail: (error: Error) => void = () => {};
  vi.mocked(startSession).mockImplementation(
    () =>
      new Promise((_, reject) => {
        fail = reject;
      }),
  );
  const { container } = render(<Home />);
  const field = container.querySelector("textarea");
  const form = container.querySelector("form");
  if (!field || !form) throw new Error("Missing composer");
  act(() => {
    field.value = "Review startup";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(startSession).toHaveBeenCalledTimes(1);
  expect(form.getAttribute("aria-busy")).toBe("true");
  expect(field.value).toBe("Review startup");
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  await act(async () => {
    fail(new Error("Agent did not answer"));
  });
  expect(form.getAttribute("aria-busy")).toBe("false");
  expect(field.value).toBe("Review startup");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Agent did not answer");
  expect(container.querySelector<HTMLButtonElement>('[type="submit"]')?.disabled).toBe(false);
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

it("offers OpenCode and OpenCode 2 independently and launches the selected agent", async () => {
  const stable = agents.value.find((agent) => agent.name === "opencode");
  if (!stable) throw new Error("Missing OpenCode fixture");
  agents.value = [...agents.value, { ...stable, name: "opencode2", command: "opencode2" }];
  lastAgent.value = "opencode";
  const { container } = render(<Home />);
  expect(container.querySelectorAll('button[title="opencode"]')).toHaveLength(1);
  expect(container.querySelector(".ui-select-trigger")).toBeNull();
  const beta = container.querySelector<HTMLButtonElement>('button[title="opencode2"]');
  if (!beta) throw new Error("Missing beta agent");
  act(() => beta.click());
  expect(beta.getAttribute("aria-pressed")).toBe("true");
  expect(container.querySelectorAll('button[title="opencode"]')).toHaveLength(1);
  const field = container.querySelector("textarea");
  const form = container.querySelector("form");
  if (!field || !form) throw new Error("Missing composer");
  await act(async () => {
    field.value = "Review beta";
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(startSession).toHaveBeenCalledWith(
    expect.objectContaining({ agent: "opencode2", task: "Review beta" }),
    "directory",
    null,
  );
});
