import { QuestionCard } from "@apex/ui";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

const OPTIONS = [
  { id: "one", label: "Browser nativo" },
  { id: "two", label: "Tandas del BYOK" },
];

function card(over: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onAnswer = vi.fn();
  const onSkip = vi.fn();
  const { container } = render(
    <QuestionCard
      question="¿En qué seguimos?"
      options={OPTIONS}
      onAnswer={onAnswer}
      onSkip={onSkip}
      {...over}
    />,
  );
  const rows = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-row"));
  const submit = () =>
    Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (node) => node.textContent === "Submit",
    );
  return { container, rows, submit, onAnswer, onSkip };
}

describe("answering a question", () => {
  it("offers every option plus a place to write your own", () => {
    const { rows } = card();
    expect(rows().map((row) => row.querySelector(".ui-question-row-label")?.textContent)).toEqual([
      "Browser nativo",
      "Tandas del BYOK",
      "Other",
    ]);
    expect(rows().map((row) => row.querySelector(".ui-question-row-key")?.textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
  });

  it("will not send until something is picked", () => {
    const { rows, submit, onAnswer } = card();
    expect(submit()?.disabled).toBe(true);

    act(() => rows()[0].click());
    expect(submit()?.disabled).toBe(false);

    act(() => submit()?.click());
    expect(onAnswer).toHaveBeenCalledWith("one");
  });

  it("keeps its own answer behind a box you have to fill", () => {
    const { container, rows, submit, onAnswer } = card();
    expect(container.querySelector(".ui-question-own")).toBeNull();

    act(() => rows()[2].click());
    const own = container.querySelector<HTMLInputElement>(".ui-question-own");
    expect(own).not.toBeNull();
    expect(submit()?.disabled).toBe(true);

    act(() => {
      if (own) {
        own.value = "otra cosa";
        own.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    act(() => submit()?.click());
    expect(onAnswer).toHaveBeenCalledWith("otra cosa");
  });

  it("takes a number key for the option that carries it", () => {
    const { container, submit, onAnswer } = card();
    const root = container.querySelector<HTMLElement>(".ui-question");

    act(() => {
      root?.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
    });
    act(() => submit()?.click());
    expect(onAnswer).toHaveBeenCalledWith("two");
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
