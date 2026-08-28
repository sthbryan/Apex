import { type AskedQuestion, OWN, QuestionCard } from "@apex/ui";
import { act } from "preact/test-utils";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";

function asked(over: Partial<AskedQuestion> = {}): AskedQuestion {
  return {
    id: "one",
    question: "¿En qué seguimos?",
    options: [
      { id: "browser", label: "Browser nativo", hint: "el plan del webview" },
      { id: "byok", label: "Tandas del BYOK" },
    ],
    ...over,
  };
}

function card(over: Partial<Parameters<typeof QuestionCard>[0]> = {}) {
  const onPick = vi.fn();
  const onAnswer = vi.fn();
  const onSkip = vi.fn();
  const onJump = vi.fn();
  const { container } = render(
    <QuestionCard
      questions={[asked()]}
      at={0}
      onPick={onPick}
      onAnswer={onAnswer}
      onSkip={onSkip}
      onJump={onJump}
      {...over}
    />,
  );
  const rows = () => Array.from(container.querySelectorAll<HTMLButtonElement>(".ui-question-row"));
  const send = () => container.querySelector<HTMLButtonElement>(".ui-question-send");
  const items = () => Array.from(container.querySelectorAll<HTMLElement>(".ui-question-item"));
  const titles = () =>
    Array.from(container.querySelectorAll(".ui-question-title")).map((node) => node.textContent);
  const answers = () =>
    Array.from(container.querySelectorAll(".ui-question-answer")).map((node) => node.textContent);
  return { container, rows, send, items, titles, answers, onPick, onAnswer, onSkip, onJump };
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
    expect(onPick).toHaveBeenCalledWith("one", "byok");
  });

  it("takes a number key for the option that carries it", () => {
    const { container, onPick } = card();
    act(() => {
      container
        .querySelector<HTMLElement>(".ui-question")
        ?.dispatchEvent(new KeyboardEvent("keydown", { key: "2", bubbles: true }));
    });
    expect(onPick).toHaveBeenCalledWith("one", "byok");
  });

  it("stays clickable so a fast click is never swallowed", () => {
    const { send, onAnswer } = card();
    expect(send()?.hasAttribute("disabled")).toBe(false);
    expect(send()?.getAttribute("aria-disabled")).toBe("true");

    act(() => send()?.click());
    expect(onAnswer).toHaveBeenCalled();
  });

  it("lights up once something is picked", () => {
    const { send } = card({ questions: [asked({ picked: "browser" })] });
    expect(send()?.getAttribute("aria-disabled")).toBe("false");
  });

  it("holds an own answer back until the box has something in it", () => {
    const empty = card({ questions: [asked({ picked: OWN, own: "  " })] });
    expect(empty.send()?.getAttribute("aria-disabled")).toBe("true");
    expect(empty.container.querySelector(".ui-question-own")).not.toBeNull();

    const filled = card({ questions: [asked({ picked: OWN, own: "otra cosa" })] });
    expect(filled.send()?.getAttribute("aria-disabled")).toBe("false");
  });

  it("will not send twice while the first answer is on its way", () => {
    const { send, onAnswer } = card({ questions: [asked({ picked: "browser" })], sent: true });
    act(() => send()?.click());
    act(() => send()?.click());
    expect(onAnswer).not.toHaveBeenCalled();
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

describe("a whole set of questions", () => {
  const THREE = [
    asked({ id: "1", question: "una", answer: "la primera" }),
    asked({ id: "2", question: "otra" }),
    asked({ id: "3", question: "la ultima" }),
  ];

  it("lists them all so you can see what is coming", () => {
    const { titles, container } = card({ questions: THREE, at: 1, headingLabel: "3 questions" });
    expect(titles()).toEqual(["una", "otra", "la ultima"]);
    expect(container.querySelector(".ui-question-heading")?.textContent).toBe("3 questions");
  });

  it("opens only the one you are on", () => {
    const { items, rows } = card({ questions: THREE, at: 1 });
    expect(items()[1].dataset.here).toBe("true");
    expect(items()[0].dataset.here).toBeUndefined();
    expect(rows()).toHaveLength(3);
  });

  it("keeps every answer in the same card", () => {
    const { answers } = card({ questions: THREE, at: 1 });
    expect(answers()).toEqual(["la primera"]);
  });

  it("lets you jump to one you already passed", () => {
    const { items, onJump } = card({ questions: THREE, at: 1 });
    act(() => items()[0].querySelector<HTMLButtonElement>(".ui-question-ask")?.click());
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it("numbers them only when there is more than one", () => {
    const many = card({ questions: THREE, at: 0 });
    expect(many.container.querySelectorAll(".ui-question-number")).toHaveLength(3);

    const lone = card();
    expect(lone.container.querySelectorAll(".ui-question-number")).toHaveLength(0);
  });

  it("closes up and drops the footer once every answer is in", () => {
    const settled = THREE.map((one) => ({ ...one, answer: `respuesta a ${one.question}` }));
    const { container, rows, answers } = card({ questions: settled, at: -1, onDismiss: () => {} });

    expect(rows()).toHaveLength(0);
    expect(container.querySelector(".ui-question-foot")).toBeNull();
    expect(container.querySelector(".ui-question-dismiss")).toBeNull();
    expect(container.querySelector<HTMLElement>(".ui-question")?.dataset.settled).toBe("true");
    expect(answers()).toHaveLength(3);
  });
});
