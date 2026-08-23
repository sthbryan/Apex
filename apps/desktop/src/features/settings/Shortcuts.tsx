import { Field, KbdGroup, SettingsDialog, SettingsHeading } from "@apex/ui";
import { useState } from "preact/hooks";
import { SHORTCUTS, type Shortcut } from "@/app/keymap";
import { closePage, page } from "@/app/view";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

const GROUPS: Shortcut["group"][] = ["navigation", "panes"];

export function Shortcuts() {
  const [group, setGroup] = useState<Shortcut["group"]>("navigation");
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? SHORTCUTS.filter((shortcut) =>
        `${t(shortcut.label)} ${shortcut.keys}`.toLowerCase().includes(needle),
      )
    : SHORTCUTS.filter((shortcut) => shortcut.group === group);

  return (
    <SettingsDialog
      open={page.value === "shortcuts"}
      onClose={closePage}
      title={t("shortcuts.title")}
      navTitle={t("shortcuts.title")}
      sections={GROUPS.map((option) => ({
        id: option,
        label: t(`shortcuts.groups.${option}` as const),
      }))}
      section={group}
      onSection={(id) => {
        setQuery("");
        setGroup(id as Shortcut["group"]);
      }}
      search={
        <input
          type="search"
          value={query}
          placeholder={t("shortcuts.search")}
          autocomplete="off"
          spellcheck={false}
          onInput={(event) => setQuery(event.currentTarget.value)}
        />
      }
      close={
        <button
          type="button"
          title={t("shortcuts.close")}
          onClick={closePage}
          class="flex size-6 items-center justify-center rounded text-faint transition-colors hover:bg-raised hover:text-text"
        >
          <Icon name="close" />
        </button>
      }
    >
      {shown.length === 0 && <p class="text-faint">{t("shortcuts.noMatch")}</p>}
      {GROUPS.map((option) => {
        const rows = shown.filter((shortcut) => shortcut.group === option);
        if (rows.length === 0) {
          return null;
        }
        return (
          <section key={option}>
            {needle && <SettingsHeading title={t(`shortcuts.groups.${option}` as const)} />}
            {rows.map((shortcut) => (
              <Field key={shortcut.id} label={t(shortcut.label)}>
                <KbdGroup keys={shortcut.keys.split(" + ")} />
              </Field>
            ))}
          </section>
        );
      })}
    </SettingsDialog>
  );
}
