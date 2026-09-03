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

function entries(count = 3): AcpEntry[] {
  return [ask(1, 0, ["a", "b"]), ask(2, 1, ["c", "d"]), ask(3, 2, ["e", "f"])]
    .slice(0, count)
    .map((one, index) => ({ index, at: 0, body: { type: "permission", ask: one } }));
}

function decided() {
  return invoke.mock.calls.filter((call) => (call as unknown[])[0] === "acp_decide");
}

function view() {
  const { container } = render(<AcpView id={ID} />);
  const items = () => Array.from(container.querySelectorAll<HTMLElement>(".ui-question-item"));
  const rows = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-row"));
  const send = () => container.querySelector<HTMLButtonElement>(".ui-question-send");
  const button = (label: string) =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (item) => item.textContent === label,
    );
  return { container, items, rows, send, button };
}

beforeEach(() => {
  invoke.mockClear();
  transcripts.value = { [ID]: entries() };
  sessions.value = [{ id: ID, state: "blocked" } as (typeof sessions.value)[number]];
});

describe("a set of questions from one call", () => {
  it("starts with the first question", () => {
    const { container, items } = view();
    expect(container.querySelector(".ui-question-heading")?.textContent).toBe("Question 1 of 3");
    expect(items()).toHaveLength(1);
    expect(container.querySelector(".ui-question-title")?.textContent).toBe("pregunta 1");
  });

  it("waits until every question in the group has arrived", () => {
    transcripts.value = { [ID]: entries(1) };
    const { container } = view();
    expect(container.querySelector(".ui-question")).toBeNull();
    act(() => {
      transcripts.value = { [ID]: entries(3) };
    });
    expect(container.querySelectorAll(".ui-question-item")).toHaveLength(1);
  });

  it("moves locally before submitting every answer once", () => {
    const { rows, send } = view();
    act(() => rows()[0].click());
    act(() => send()?.click());
    expect(decided()).toHaveLength(0);
    act(() => rows()[1].click());
    act(() => send()?.click());
    expect(decided()).toHaveLength(0);
    act(() => rows()[0].click());
    act(() => send()?.click());
    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: "a" }],
      ["acp_decide", { id: ID, request: 2, option: "d" }],
      ["acp_decide", { id: ID, request: 3, option: "e" }],
    ]);
  });

  it("sends unanswered questions as skipped", () => {
    const { rows, send, button } = view();
    act(() => button("Skip")?.click());
    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => button("Skip")?.click());
    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: null }],
      ["acp_decide", { id: ID, request: 2, option: "c" }],
      ["acp_decide", { id: ID, request: 3, option: null }],
    ]);
  });

  it("takes the final pick and submit in the same render", () => {
    const { rows, send } = view();
    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => {
      rows()[1].click();
      send()?.click();
    });
    expect(decided()[2]).toEqual(["acp_decide", { id: ID, request: 3, option: "f" }]);
  });

  it("does not send the set twice", () => {
    const { rows, send } = view();
    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => send()?.click());
    expect(decided()).toHaveLength(3);
  });
});

describe("once the whole set is answered", () => {
  it("keeps the answers together as a compact summary", () => {
    const { container } = view();
    act(() => {
      transcripts.value = {
        [ID]: entries().map((entry, index) => {
          if (entry.body.type !== "permission") throw new Error("expected permission");
          return {
            ...entry,
            body: {
              type: "permission",
              ask: {
                ...entry.body.ask,
                decided: index === 2 ? "cancelled" : ["a", "c"][index],
              },
            },
          };
        }),
      };
    });
    expect(container.querySelectorAll(".ui-question")).toHaveLength(1);
    expect(container.querySelectorAll(".ui-question-row")).toHaveLength(0);
    expect(
      Array.from(container.querySelectorAll(".ui-question-answer")).map((node) => node.textContent),
    ).toEqual(["a", "c", "no answer"]);
  });
});
