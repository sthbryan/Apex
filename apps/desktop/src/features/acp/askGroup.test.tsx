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
  const send = () => container.querySelector<HTMLButtonElement>(".ui-question-send");
  const marks = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-mark"));
  const here = () => marks().findIndex((mark) => mark.dataset.here === "true") + 1;
  const title = () => container.querySelector(".ui-question-title")?.textContent;
  return { container, rows, button, send, marks, here, title };
}

beforeEach(() => {
  invoke.mockClear();
  seed();
  // biome-ignore lint/suspicious/noExplicitAny: test fixture
  sessions.value = [{ id: ID, state: "blocked" } as any];
});

describe("a set of questions from one call", () => {
  it("shows one at a time and says which one it is on", () => {
    const { here, title, rows, marks } = view();
    expect(here()).toBe(1);
    expect(title()).toBe("pregunta 1");
    expect(rows()).toHaveLength(3);
    expect(marks()).toHaveLength(3);
  });

  it("holds every answer back until the last one is in", () => {
    const { rows, here, send } = view();

    act(() => rows()[0].click());
    act(() => send()?.click());
    expect(decided()).toEqual([]);
    expect(here()).toBe(2);

    act(() => rows()[0].click());
    act(() => send()?.click());
    expect(decided()).toEqual([]);
    expect(here()).toBe(3);

    act(() => rows()[1].click());
    act(() => send()?.click());

    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: "a" }],
      ["acp_decide", { id: ID, request: 2, option: "c" }],
      ["acp_decide", { id: ID, request: 3, option: "f" }],
    ]);
  });

  it("lets you walk back and keeps what you had picked", () => {
    const { rows, here, send, button, container } = view();

    act(() => rows()[1].click());
    act(() => send()?.click());
    expect(button("Back")).toBeDefined();

    act(() => button("Back")?.click());
    expect(here()).toBe(1);
    expect(container.querySelector<HTMLElement>(".ui-question-row[data-picked]")?.textContent).toBe(
      "b2",
    );
  });

  it("records a skipped question as no answer and carries on", () => {
    const { rows, here, send, button } = view();

    act(() => button("Skip")?.click());
    expect(here()).toBe(2);
    expect(decided()).toEqual([]);

    act(() => button("Skip")?.click());
    act(() => rows()[0].click());
    act(() => send()?.click());

    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: null }],
      ["acp_decide", { id: ID, request: 2, option: null }],
      ["acp_decide", { id: ID, request: 3, option: "e" }],
    ]);
  });

  it("answers them all with nothing when the set is waved away", () => {
    const { rows, send, container } = view();

    act(() => rows()[0].click());
    act(() => send()?.click());
    act(() => container.querySelector<HTMLButtonElement>(".ui-question-dismiss")?.click());

    expect(decided()).toEqual([
      ["acp_decide", { id: ID, request: 1, option: "a" }],
      ["acp_decide", { id: ID, request: 2, option: null }],
      ["acp_decide", { id: ID, request: 3, option: null }],
    ]);
  });
});

describe("not letting one answer go out twice", () => {
  it("takes the pick and the send in the same breath", () => {
    const { rows, send, here } = view();

    act(() => {
      rows()[0].click();
      send()?.click();
    });

    expect(here()).toBe(2);
  });

  it("goes quiet after the last answer is on its way", () => {
    const { rows, send, container } = view();

    for (let step = 0; step < 3; step += 1) {
      act(() => rows()[0].click());
      act(() => send()?.click());
    }
    expect(decided()).toHaveLength(3);

    act(() => send()?.click());
    expect(decided()).toHaveLength(3);
    expect(container.querySelector<HTMLElement>(".ui-question")?.dataset.sent).toBe("true");
  });

  it("can jump straight to a question further along", () => {
    const { marks, here, title } = view();

    act(() => marks()[2].click());
    expect(here()).toBe(3);
    expect(title()).toBe("pregunta 3");
  });
});
