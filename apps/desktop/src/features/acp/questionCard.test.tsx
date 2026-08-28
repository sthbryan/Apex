import { OWN, QuestionCard } from "@apex/ui";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const OPTIONS = [
  { id: "one", label: "Browser nativo", hint: "el plan del webview" },
  { id: "two", label: "Tandas del BYOK" },
];

function card(over: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onPick = vi.fn();
  const onAnswer = vi.fn();
  const onSkip = vi.fn();
  const onJump = vi.fn();
  const { container } = render(
    <QuestionCard
      question="¿En qué seguimos?"
      options={OPTIONS}
      onPick={onPick}
      onAnswer={onAnswer}
      onSkip={onSkip}
      onJump={onJump}
      {...over}
    />,
  );
  const rows = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-row"));
  const send = () => container.querySelector<HTMLButtonElement>(".ui-question-send");
  const marks = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-mark"));
  return { container, rows, send, marks, onPick, onAnswer, onSkip, onJump };
}

describe("answering a question", () => {
  it("offers every option plus a place to write your own", () => {
    const { rows } = card();
    expect(rows().map((row) => row.querySelector(".ui-question-row-label")?.textContent)).toEqual([
      "Browser nativo",
      "Tandas del BYOK",
      "Other",
    ]);
    expect(rows()[0].querySelector(".ui-question-row-hint")?.textContent).toBe(
      "el plan del webview",
    );
  });

  it("hands the pick up instead of keeping it", () => {
    const { rows, onPick } = card();
    act(() => rows()[1].click());
    expect(onPick).toHaveBeenCalledWith("two");
  });

  it("takes a number key for the option that carries it", () => {
    const { container, onPick } = card();
    act(() => {
      container
        .querySelector<HTMLElement>(".ui-question")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
    });
    expect(onPick).toHaveBeenCalledWith("two");
  });

  it("stays clickable so a fast click is never swallowed", () => {
    const { send, onAnswer } = card();
    expect(send()?.hasAttribute("disabled")).toBe(false);
    expect(send()?.getAttribute("aria-disabled")).toBe("true");

    act(() => send()?.click());
    expect(onAnswer).toHaveBeenCalled();
  });

  it("sends once something is picked", () => {
    const { send, onAnswer } = card({ picked: "one" });
    expect(send()?.getAttribute("aria-disabled")).toBe("false");
    act(() => send()?.click());
    expect(onAnswer).toHaveBeenCalled();
  });

  it("holds an own answer back until the box has something in it", () => {
    const empty = card({ picked: OWN, own: "  " });
    expect(empty.send()?.getAttribute("aria-disabled")).toBe("true");
    expect(empty.container.querySelector(".ui-question-own")).not.toBeNull();

    const filled = card({ picked: OWN, own: "otra cosa" });
    expect(filled.send()?.getAttribute("aria-disabled")).toBe("false");
  });

  it("will not send twice while the first answer is on its way", () => {
    const { send, onAnswer } = card({ picked: "one", sent: true });
    act(() => send()?.click());
    act(() => send()?.click());
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("shows the whole set up front and lets you jump", () => {
    const { marks, onJump } = card({
      marks: [
        { label: "una", answered: true, here: false },
        { label: "otra", answered: false, here: true },
        { label: "la ultima", answered: false, here: false },
      ],
    });
    expect(marks()).toHaveLength(3);
    expect(marks()[0].dataset.answered).toBe("true");
    expect(marks()[1].dataset.here).toBe("true");

    act(() => marks()[2].click());
    expect(onJump).toHaveBeenCalledWith(2);
  });

  it("keeps the stepper out of the way when there is only one question", () => {
    const { marks } = card({ marks: [{ label: "una", answered: false, here: true }] });
    expect(marks()).toHaveLength(0);
  });

  it("goes quiet once it has an answer", () => {
    const { container, rows } = card({ answer: "Browser nativo" });
    expect(rows()).toHaveLength(0);
    expect(container.textContent).toContain("Answered: Browser nativo");
  });

  it("can be waved away", () => {
    const { container, onSkip } = card();
    const skip = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === "Skip",
    );
    act(() => skip?.click());
    expect(onSkip).toHaveBeenCalled();
  });
});
