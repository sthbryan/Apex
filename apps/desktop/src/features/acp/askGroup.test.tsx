import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AcpEntry } from "@/bindings/AcpEntry";
import type { AcpPermission } from "@/bindings/AcpPermission";
import { AcpView } from "@/features/acp/AcpView";
import { transcripts } from "@/features/acp/state";
import { sessions } from "@/features/sessions/state";
import { render } from "@/test/render";

const invoke = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const ID = "one";

function ask(request: number, at: number, labels: string[]): AcpPermission {
  return {
    request,
    title: `pregunta ${at + 1}`,
    decided: null,
    group: "call-1",
    at,
    of: 3,
    options: labels.map((label) => ({ id: label, name: label, about: null, kind: "other" })),
  };
}

function seed(): void {
  const asks = [ask(1, 0, ["a", "b"]), ask(2, 1, ["c", "d"]), ask(3, 2, ["e", "f"])];
  const entries: AcpEntry[] = asks.map((one, index) => ({
    index,
    at: 0,
    body: { type: "permission", ask: one },
  }));
  transcripts.value = { [ID]: entries };
}

function decided() {
  return invoke.mock.calls.filter((call) => (call as unknown[])[0] === "acp_decide");
}

function view() {
  const { container } = render(<AcpView id={ID} />);
  const rows = () => Array.from(container.querySelectorAll<HTMLElement>(".ui-question-row"));
  const button = (label: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-foot button")).find(
      (node) => node.textContent === label,
    );
  const step = () => container.querySelector(".ui-question-step")?.textContent;
  const title = () => container.querySelector(".ui-question-title")?.textContent;
  return { container, rows, button, step, title };
}

beforeEach(() => {
  invoke.mockClear();
  seed();
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  sessions.value = [{ id: ID, state: "blocked" } as any];
});

describe("a set of questions from one call", () => {
  it("shows one at a time and says which one it is on", () => {
    const { step, title, rows } = view();
    expect(step()).toBe("1/3");
    expect(title()).toBe("pregunta 1");
    expect(rows()).toHaveLength(3);
  });

  it("holds every answer back until the last one is in", () => {
    const { rows, button, step } = view();

    act(() => rows()[0].click());
    act(() => button("Next")?.click());
    expect(decided()).toEqual([]);
    expect(step()).toBe("2/3");

    act(() => rows()[0].click());
    act(() => button("Next")?.click());
    expect(decided()).toEqual([]);
    expect(step()).toBe("3/3");

    act(() => rows()[1].click());
    act(() => button("Submit")?.click());

    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: "a" }],
      ["acp_decide", { id: ID, request: 2, option: "c" }],
      ["acp_decide", { id: ID, request: 3, option: "f" }],
    ]);
  });

  it("lets you walk back and keeps what you had picked", () => {
    const { rows, button, step, container } = view();

    act(() => rows()[1].click());
    act(() => button("Next")?.click());
    expect(button("Back")).toBeDefined();

    act(() => button("Back")?.click());
    expect(step()).toBe("1/3");
    expect(container.querySelector<HTMLElement>(".ui-question-row[data-picked]")?.textContent).toBe(
      "b2",
    );
  });

  it("records a skipped question as no answer and carries on", () => {
    const { rows, button, step } = view();

    act(() => button("Skip")?.click());
    expect(step()).toBe("2/3");
    expect(decided()).toEqual([]);

    act(() => button("Skip")?.click());
    act(() => rows()[0].click());
    act(() => button("Submit")?.click());

    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: null }],
      ["acp_decide", { id: ID, request: 2, option: null }],
      ["acp_decide", { id: ID, request: 3, option: "e" }],
    ]);
  });

  it("answers them all with nothing when the set is waved away", () => {
    const { rows, button, container } = view();

    act(() => rows()[0].click());
    act(() => button("Next")?.click());
    act(() => container.querySelector<HTMLButtonElement>(".ui-question-dismiss")?.click());

    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: "a" }],
      ["acp_decide", { id: ID, request: 2, option: null }],
      ["acp_decide", { id: ID, request: 3, option: null }],
    ]);
  });
});
