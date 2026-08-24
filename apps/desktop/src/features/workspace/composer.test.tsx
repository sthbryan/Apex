import { Composer } from "@apex/ui";
import { useState } from "preact/hooks";
import { act } from "preact/test-utils";
import { describe, expect, it } from "vitest";
import { render } from "@/test/render";

function Host() {
  const [task, setTask] = useState("una tarea escrita");
  return (
    <Composer
      label="task"
      value={task}
      onInput={(event) => setTask((event.currentTarget as HTMLTextAreaElement).value)}
      onSubmit={(event) => {
        event.preventDefault();
        setTask("");
      }}
      actions={<button type="submit">send</button>}
    />
  );
}

describe("the composer", () => {
  it("empties when whoever owns it clears the value", () => {
    const { container } = render(<Host />);
    const field = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(field.value).toBe("una tarea escrita");

    act(() => {
      container.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true }));
    });

    expect(field.value).toBe("");
  });
});
