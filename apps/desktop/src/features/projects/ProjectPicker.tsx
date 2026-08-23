import { Button, Glyph, ListRow, Pill, Popover, ProjectButton } from "@apex/ui";
import { useState } from "preact/hooks";
import {
  activeProject,
  pickProject,
  projects,
  removeProject,
  switchTo,
} from "@/features/projects/state";
import { sessions } from "@/features/sessions/state";
import { t } from "@/shared/i18n";
import { Icon } from "@/shared/ui/Icon";

export function ProjectPicker() {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<string | null>(null);
  const current = activeProject.value;

  const close = () => {
    setOpen(false);
    setAsking(null);
  };

  const waiting = waitingElsewhere();

  return (
    <Popover
      open={open}
      onClose={close}
      block
      side="bottom"
      align="start"
      width={300}
      title={t("projects.title")}
      anchor={
        <ProjectButton
          name={current?.name ?? t("projects.none")}
          path={current ? prettyRoot(current.root) : undefined}
          icon={<Icon name="files" size={13} />}
          alert={
            waiting > 0 ? t("projects.waitingElsewhere", { count: String(waiting) }) : undefined
          }
          title={current?.root ?? t("projects.none")}
          trail={<Icon name="chevron" size={12} class="shrink-0 text-faint" />}
          onClick={() => setOpen((shown) => !shown)}
        />
      }
    >
      {projects.value.map((project) => {
        const live = countLive(project.id);
        const blocked = countBlocked(project.id);
        const mine = project.id === current?.id;

        if (asking === project.id) {
          return (
            <ListRow
              key={project.id}
              as="div"
              label={t("projects.removeAsk")}
              class="text-state-failed"
              actions={
                <>
                  <Button variant="subtle" size="xs" onClick={() => setAsking(null)}>
                    {t("projects.removeCancel")}
                  </Button>
                  <Button
                    variant="danger"
                    size="xs"
                    onClick={() => {
                      close();
                      void removeProject(project.id);
                    }}
                  >
                    {t("projects.remove")}
                  </Button>
                </>
              }
            />
          );
        }

        return (
          <ListRow
            key={project.id}
            label={project.name}
            sub={<span class="font-mono">{prettyRoot(project.root)}</span>}
            selected={mine}
            lead={
              <Glyph size="sm">
                <Icon name={mine ? "check" : "fileText"} size={11} />
              </Glyph>
            }
            trail={
              blocked > 0 ? (
                <Pill tone="blocked">{t("projects.blocked", { count: String(blocked) })}</Pill>
              ) : live > 0 ? (
                <Pill tone="accent">{t("projects.live", { count: String(live) })}</Pill>
              ) : undefined
            }
            actions={
              live === 0 ? (
                <Button
                  variant="subtle"
                  size="xs"
                  iconOnly
                  title={t("projects.remove")}
                  aria-label={t("projects.remove")}
                  onClick={(event) => {
                    event.stopPropagation();
                    setAsking(project.id);
                  }}
                >
                  <Icon name="close" size={11} />
                </Button>
              ) : undefined
            }
            onClick={() => {
              close();
              void switchTo(project.id);
            }}
          />
        );
      })}

      <ListRow
        label={t("projects.open")}
        lead={
          <Glyph size="sm">
            <Icon name="plus" size={11} />
          </Glyph>
        }
        onClick={() => {
          close();
          void pickProject();
        }}
      />
    </Popover>
  );
}

function prettyRoot(root: string): string {
  const cut = root.lastIndexOf("/");
  const parent = cut > 0 ? root.slice(0, cut) : root;
  return parent.replace(/^\/(Users|home)\/[^/]+/, "~");
}

function countBlocked(projectId: string): number {
  return sessions.value.filter(
    (session) => session.project_id === projectId && session.state === "blocked",
  ).length;
}

function countLive(projectId: string): number {
  return sessions.value.filter(
    (session) => session.project_id === projectId && session.exit_code === null,
  ).length;
}

function waitingElsewhere(): number {
  return sessions.value.filter(
    (session) => session.project_id !== activeProject.value?.id && session.state === "blocked",
  ).length;
}
