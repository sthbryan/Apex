import type { ComponentChildren, JSX, Ref } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";
import { cn } from "@/lib/cn";

export interface TabBarProps extends Omit<JSX.IntrinsicElements["div"], "ref"> {
  label: string;
  elRef?: Ref<HTMLDivElement>;
  onAdd?: () => void;
  addLabel?: string;
  addIcon?: ComponentChildren;
  children?: ComponentChildren;
}

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

export function TabBar({ label, elRef, onAdd, addLabel = "New tab", addIcon, class: className, children, ...rest }: TabBarProps) {
  const list = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const found = list.current?.querySelectorAll<HTMLElement>('[role="tab"]');
    const tabs = found ? Array.from(found) : [];
    if (tabs.length === 0) return;
    const stop = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? tabs[0];
    for (const tab of tabs) tab.tabIndex = tab === stop ? 0 : -1;
  });

  const onKeyDown = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    const step = STEP[event.key];
    if (step === undefined && event.key !== "Home" && event.key !== "End") return;
    const found = list.current?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])');
    const tabs = found ? Array.from(found) : [];
    if (tabs.length === 0) return;
    const from = tabs.indexOf(document.activeElement as HTMLElement);
    const to = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : (from + step + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[to]?.focus();
  };

  return (
    <div class={cn("ui-tab-bar ui-chrome", className as string)} ref={elRef} {...rest}>
      <div class="ui-tab-bar-tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown} ref={list}>
        {children}
      </div>
      {onAdd ? (
        <button type="button" class="ui-tab-add" aria-label={addLabel} title={addLabel} onClick={onAdd}>
          {addIcon ?? "+"}
        </button>
      ) : null}
    </div>
  );
}

export interface TabProps extends Omit<JSX.IntrinsicElements["div"], "ref" | "title"> {
  title: string;
  selected?: boolean;
  lead?: ComponentChildren;
  trail?: ComponentChildren;
  onOpen?: () => void;
  elRef?: Ref<HTMLDivElement>;
}

export function Tab({
  title, selected, lead, trail, onOpen, elRef, class: className, ...rest
}: TabProps) {
  return (
    <div
      class={cn("ui-tab", className as string)}
      ref={elRef}
      role="tab"
      aria-selected={selected ?? false}
      tabIndex={selected ? 0 : -1}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      {...rest}
    >
      <button type="button" class="ui-tab-open" tabIndex={-1} title={title} onClick={onOpen}>
        {lead}
        <span class="ui-tab-title">{title}</span>
      </button>
      {trail}
    </div>
  );
}
