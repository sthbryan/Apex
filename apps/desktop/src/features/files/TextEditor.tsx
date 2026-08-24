import { CodeGutter, CodeView } from "@apex/ui";
import { useEffect, useRef, useState } from "preact/hooks";

import { highlight } from "@/features/files/highlight";

const INDENT = "  ";
const HIGHLIGHT_DELAY = 140;

type Props = {
  text: string;
  path: string;
  editable: boolean;
  onInput: (text: string) => void;
  onSave: () => void;
};

export function TextEditor({ text, path, editable, onInput, onSave }: Props) {
  const painted = usePainted(path, text);
  const area = useRef<HTMLTextAreaElement>(null);
  const lines = text.split("\n").length;

  useEffect(() => {
    const node = area.current;
    if (node && node.value !== text) {
      node.value = text;
    }
  }, [text]);

  const onKeyDown = (event: KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      onSave();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      document.execCommand("insertText", false, INDENT);
    }
  };

  return (
    <div class="min-h-0 flex-1 overflow-auto">
      <CodeView class="flex min-h-full w-max min-w-full animate-fade-in py-0">
        <CodeGutter lines={lines} />
        <div class="relative grow">
          <pre aria-hidden={editable} class="px-3 py-3">
            {painted ? <code dangerouslySetInnerHTML={{ __html: painted }} /> : <code>{text}</code>}
            {"\n"}
          </pre>
          {editable && (
            <textarea
              ref={area}
              defaultValue={text}
              wrap="off"
              spellcheck={false}
              autocapitalize="off"
              autocomplete="off"
              autocorrect="off"
              onKeyDown={onKeyDown}
              onInput={(event) => onInput(event.currentTarget.value)}
              class="absolute inset-0 resize-none overflow-hidden whitespace-pre border-0 bg-transparent px-3 py-3 text-transparent caret-text outline-none"
            />
          )}
        </div>
      </CodeView>
    </div>
  );
}

function usePainted(path: string, text: string): string | null {
  const [ready, setReady] = useState<{ text: string; markup: string | null } | null>(null);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      void highlight(path, text).then((markup) => {
        if (live) {
          setReady({ text, markup });
        }
      });
    }, HIGHLIGHT_DELAY);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [path, text]);

  return ready?.text === text ? ready.markup : null;
}
