import { Field, SettingsDialog, SettingsHeading } from "@apex/ui";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState } from "preact/hooks";
import { closePage, page, settingsSection } from "@/app/view";
import type { Section } from "@/features/settings/constants";
import {
  aboutSection,
  agentsSection,
  daemonSection,
  lookSection,
  shortcutsSection,
  spaceSection,
} from "@/features/settings/sections";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function Settings() {
  const [appVersion, setAppVersion] = useState("");
  const [query, setQuery] = useState("");
  const section = settingsSection.value;

  useEffect(() => {
    void getVersion().then(setAppVersion);
  }, []);

  const sections: Section[] = [
    lookSection(),
    spaceSection(),
    agentsSection(),
    daemonSection(),
    shortcutsSection(),
    aboutSection(appVersion),
  ];

  const needle = query.trim().toLowerCase();
  const found = needle
    ? sections
        .map((entry) => ({
          ...entry,
          panel: undefined,
          entries: entry.entries.filter((row) =>
            `${row.label} ${row.hint}`.toLowerCase().includes(needle),
          ),
        }))
        .filter((entry) => entry.entries.length > 0)
    : sections.filter((entry) => entry.id === section);

  return (
    <SettingsDialog
      open={page.value === "settings"}
      onClose={closePage}
      title={t("settings.title")}
      navTitle={t("settings.title")}
      sections={sections.map((entry) => ({
        id: entry.id,
        label: entry.label,
        icon: <Icon name={entry.icon} size={13} />,
      }))}
      section={section}
      onSection={(id) => {
        setQuery("");
        settingsSection.value = id;
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
      {found.length === 0 && <p class="text-faint">{t("settings.noMatch")}</p>}
      {found.map((entry) => (
        <section key={entry.id}>
          <SettingsHeading title={entry.label} sub={needle ? undefined : entry.sub} />
          {entry.panel}
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
