import { Modal } from "@apex/ui";
import { cancelSession, pendingSession } from "@/features/sessions/pending";
import { t } from "@/shared/i18n";
import { Choices } from "./Choices";

export function NewSession() {
  const request = pendingSession.value;

  return (
    <Modal
      open={request !== null}
      onClose={cancelSession}
      width="sm"
      title={t("isolation.title", { agent: request?.agent ?? "" })}
    >
      <Choices key={request?.id ?? 0} />
    </Modal>
  );
}
