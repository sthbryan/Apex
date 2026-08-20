import { getVersion } from "@tauri-apps/api/app";
import cn from "cnfast";
import { useEffect, useState } from "preact/hooks";

import { closePage } from "@/app/view";
import type { Section } from "@/features/settings/constants";
import { SettingsRow } from "@/features/settings/SettingsRow";
import {
  aboutSection,
  agentsSection,
  daemonSection,
  lookSection,
  spaceSection,
} from "@/features/settings/sections";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function Settings() {
  const [appVersion, setAppVersion] = useState("");
  const [section, setSection] = useState("look");
  const [query, setQuery] = useState("");

  useEffect(() => {
    void getVersion().then(setAppVersion);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePage();
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const sections: Section[] = [
    lookSection(),
    spaceSection(),
    agentsSection(),
    daemonSection(),
    aboutSection(appVersion),
  ];

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? sections
        .map((entry) => ({
          ...entry,
          entries: entry.entries.filter((row) =>
            `${row.label} ${row.hint}`.toLowerCase().includes(needle),
          ),
        }))
        .filter((entry) => entry.entries.length > 0)
    : sections.filter((entry) => entry.id === section);
  const panel = needle ? null : shown[0]?.panel;

  return (
    <div
      class="flex h-full min-h-0 flex-col bg-pane"
      role="region"
      aria-label={t("settings.title")}
    >
      <header class="flex min-h-8.5 shrink-0 select-none items-center gap-2 border-b border-border bg-chrome px-3">
        <Icon name="settings" size={14} class="shrink-0 text-faint" />
        <span class="truncate text-text">{t("settings.title")}</span>
        <button
          type="button"
          title={t("settings.close")}
          onClick={closePage}
          class="ml-auto flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" />
        </button>
      </header>

      <div class="flex min-h-0 flex-1">
        <nav class="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border p-2">
          <input
            type="search"
            value={query}
            placeholder={t("settings.search")}
            autocomplete="off"
            spellcheck={false}
            onInput={(event) => setQuery(event.currentTarget.value)}
            class="mb-1 rounded border border-border bg-overlay px-2 py-1 text-text outline-none placeholder:text-faint focus:border-muted"
          />
          {sections.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setQuery("");
                setSection(entry.id);
              }}
              class={cn(
                "rounded px-2 py-1 text-left transition-colors",
                !needle && entry.id === section
                  ? "bg-raised text-text"
                  : "text-muted hover:bg-raised hover:text-text",
              )}
            >
              {entry.label}
            </button>
          ))}
        </nav>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-3">
          <div class="mx-auto w-full max-w-5xl">
            {shown.length === 0 && <p class="text-faint">{t("settings.noMatch")}</p>}
            {panel}
            {shown.map((entry) => (
              <section key={entry.id}>
                {needle && (
                  <h3 class="pt-3 pb-1 text-micro uppercase tracking-wider text-faint first:pt-0">
                    {entry.label}
                  </h3>
                )}
                {entry.entries.map((row) => (
                  <SettingsRow key={row.id} label={row.label} hint={row.hint}>
                    {row.control}
                  </SettingsRow>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
