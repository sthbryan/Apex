import { Button, Meter } from "@apex/ui";
import { sessions } from "@/features/sessions/state";
import {
  applyUpdate,
  failure,
  fetchUpdate,
  lookForUpdate,
  offered,
  openReleases,
  progress,
  stage,
} from "@/features/updates/state";
import { t } from "@/shared/i18n";

export function UpdateNote() {
  const version = offered.value?.version ?? "";
  switch (stage.value) {
    case "checking":
      return <>{t("settings.updateChecking")}</>;
    case "current":
      return <>{t("settings.updateCurrent")}</>;
    case "found":
      return <>{t("settings.updateFound", { version })}</>;
    case "downloading":
      return (
        <Meter
          label={t("settings.updateDownloading")}
          value={progress.value * 100}
          class="w-full"
        />
      );
    case "manual":
      return <>{t("settings.updateManual", { version })}</>;
    case "ready": {
      const live = sessions.value.filter((session) => session.exit_code === null).length;
      return (
        <>
          {t("settings.updateReady", { version })}
          {live > 0 ? ` ${t("settings.updateEndsSessions", { live: String(live) })}` : null}
        </>
      );
    }
    case "failed":
      return <>{failure.value ?? t("settings.updateFailed")}</>;
    default:
      return null;
  }
}

export function UpdateAction() {
  switch (stage.value) {
    case "checking":
      return (
        <Button loading disabled>
          {t("settings.updateChecking")}
        </Button>
      );
    case "downloading":
      return (
        <Button loading disabled>
          {t("settings.updateDownloading")}
        </Button>
      );
    case "found":
      return <Button onClick={() => void fetchUpdate()}>{t("settings.updateDownload")}</Button>;
    case "manual":
      return <Button onClick={() => void openReleases()}>{t("settings.updateOpenRelease")}</Button>;
    case "ready":
      return (
        <Button variant="primary" onClick={() => void applyUpdate()}>
          {t("settings.updateRestart")}
        </Button>
      );
    default:
      return <Button onClick={() => void lookForUpdate()}>{t("settings.checkUpdates")}</Button>;
  }
}
