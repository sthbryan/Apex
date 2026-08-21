import type { ComponentChildren, JSX } from "preact";
import { cn } from "@/lib/cn";

export type LogLevel = "error" | "warn" | "info";

export interface BrowserViewProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  url: string;
  onUrlInput?: JSX.GenericEventHandler<HTMLInputElement>;
  lead?: ComponentChildren;
  actions?: ComponentChildren;
  secure?: ComponentChildren;
  console?: ComponentChildren;
  consoleOpen?: boolean;
  consoleActions?: ComponentChildren;
  children?: ComponentChildren;
}

export function BrowserView({
  url,
  onUrlInput,
  lead,
  actions,
  secure,
  console: consoleSlot,
  consoleOpen,
  consoleActions,
  class: className,
  children,
  ...rest
}: BrowserViewProps) {
  return (
    <div
      class={cn("ui-browser-view", className as string)}
      data-console={consoleOpen ? "open" : undefined}
      {...rest}
    >
      <div class="ui-browser-bar">
        {lead}
        <div class="ui-browser-url">
          {secure}
          <input value={url} onInput={onUrlInput} aria-label="Address" spellcheck={false} />
        </div>
        {actions}
      </div>
      <div class="ui-browser-body">{children}</div>
      {consoleSlot ? (
        <div class="ui-browser-console">
          <div class="ui-browser-console-head">
            Console
            <span class="ml-auto">{consoleActions}</span>
          </div>
          <div class="ui-browser-console-list" role="log">{consoleSlot}</div>
        </div>
      ) : null}
    </div>
  );
}

export interface BrowserLogProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  level?: LogLevel;
  children?: ComponentChildren;
}

export function BrowserLog({ level = "info", class: className, children, ...rest }: BrowserLogProps) {
  return (
    <div class={cn("ui-browser-log", className as string)} data-level={level} {...rest}>{children}</div>
  );
}
