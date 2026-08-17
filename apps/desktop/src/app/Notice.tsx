import { hush, notices } from "@/shared/daemon";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function Notice() {
  if (notices.value.length === 0) {
    return null;
  }
  return (
    <div class="fixed right-4 bottom-10 z-50 flex w-80 flex-col gap-2">
      {notices.value.map((notice) => (
        <output
          key={notice.id}
          class="relative flex animate-rise-in items-start gap-3 overflow-hidden rounded-lg border border-state-failed bg-overlay px-3 py-2 text-text shadow-2xl"
        >
          <span class="min-w-0 flex-1 whitespace-pre-wrap">{notice.text}</span>
          <button
            type="button"
            title={t("sessions.dismiss")}
            onClick={() => hush(notice.id)}
            class="grid h-5 w-5 shrink-0 place-items-center text-faint transition-colors hover:text-text"
          >
            <Icon name="close" size={12} />
          </button>
          <span
            aria-hidden="true"
            class="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-state-failed animate-shrink"
          />
        </output>
      ))}
    </div>
  );
}
