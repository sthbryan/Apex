import { useSignalEffect } from "@preact/signals";
import { Toaster, toast } from "sonner";

import type { Notice } from "@/features/notifications/state";
import { dismissToast, lasting, live, notices } from "@/features/notifications/state";
import { sessions } from "@/features/sessions/state";
import { focusSession, openInNewTab } from "@/features/workspace/state";
import { t } from "@/shared/i18n";

const RUNS = 6000;

export function Toasts() {
  useSignalEffect(() => {
    const active = new Set(live.value);
    for (const notice of notices.value) {
      if (active.has(notice.id) && !toast.getToasts().some((shown) => shown.id === notice.id)) {
        show(notice);
      }
    }
    for (const shown of toast.getToasts()) {
      if (typeof shown.id === "number" && !active.has(shown.id)) {
        toast.dismiss(shown.id);
      }
    }
  });

  return (
    <Toaster
      position="top-right"
      visibleToasts={4}
      gap={8}
      closeButton
      expand
      offset={{ top: 44, right: "var(--apex-controls-end, 16px)" }}
      swipeDirections={["right"]}
      toastOptions={{
        closeButtonAriaLabel: t("sessions.dismiss"),
        classNames: {
          toast: "apex-sonner-toast",
          title: "apex-sonner-title",
          description: "apex-sonner-detail",
          actionButton: "apex-sonner-action",
          closeButton: "apex-sonner-close",
        },
      }}
    />
  );
}

function show(notice: Notice): void {
  const session = sessions.value.find((candidate) => candidate.id === notice.sessionId);
  const action = session
    ? {
        label: t("notify.open"),
        onClick: () => {
          if (!focusSession(session.id)) {
            openInNewTab(session);
          }
        },
      }
    : undefined;
  const options = {
    id: notice.id,
    description: notice.body || undefined,
    duration: lasting(notice.kind) ? Number.POSITIVE_INFINITY : RUNS,
    action,
    onDismiss: () => dismissToast(notice.id),
    onAutoClose: () => dismissToast(notice.id),
  };

  switch (notice.kind) {
    case "error":
      toast.error(notice.title, options);
      break;
    case "blocked":
    case "quota":
      toast.warning(notice.title, options);
      break;
    case "done":
      toast.success(notice.title, options);
      break;
    default:
      toast(notice.title, options);
  }
}
