import { Field, SettingsDialog, SettingsHeading } from "@apex/ui";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "preact/hooks";
import { closePage } from "@/app/view";
import type { Section } from "@/features/settings/constants";
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
    <SettingsDialog
      open
      modal={false}
      onClose={closePage}
      title={t("settings.title")}
      navTitle={t("settings.title")}
      sections={sections.map((entry) => ({ id: entry.id, label: entry.label }))}
      section={section}
      onSection={(id) => {
        setQuery("");
        setSection(id);
      }}
      search={
        <input
          type="search"
          value={query}
          placeholder={t("settings.search")}
          autocomplete="off"
          spellcheck={false}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      }
      close={
        <button
          type="button"
          title={t("settings.close")}
          onClick={closePage}
          class="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" />
        </button>
      }
    >
      {shown.length === 0 && <p class="text-faint">{t("settings.noMatch")}</p>}
      {panel}
      {shown.map((entry) => (
        <section key={entry.id}>
          {needle && <SettingsHeading title={entry.label} />}
          {entry.entries.map((row) => (
            <Field key={row.id} label={row.label} hint={row.hint}>
              {row.control}
            </Field>
          ))}
        </section>
      ))}
    </SettingsDialog>
  );
}
