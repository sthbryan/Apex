import type { ComponentMeta } from "@/lib/meta";
import { agentIconMeta } from "@/atoms/agent-icon/meta";
import { badgeMeta } from "@/atoms/badge/meta";
import { barMeta } from "@/atoms/bar/meta";
import { buttonMeta } from "@/atoms/button/meta";
import { chipMeta } from "@/atoms/chip/meta";
import { dotMeta } from "@/atoms/dot/meta";
import { kbdMeta } from "@/atoms/kbd/meta";
import { pillMeta } from "@/atoms/pill/meta";
import { spinnerMeta } from "@/atoms/spinner/meta";
import { surfaceMeta } from "@/atoms/surface/meta";
import { switchMeta } from "@/atoms/switch/meta";
import { cardMeta } from "@/molecules/card/meta";
import { fieldMeta } from "@/molecules/field/meta";
import { listRowMeta } from "@/molecules/list-row/meta";
import { meterMeta } from "@/molecules/meter/meta";
import { segmentedMeta } from "@/molecules/segmented/meta";
import { statePillMeta } from "@/molecules/state-pill/meta";
import { tooltipMeta } from "@/molecules/tooltip/meta";
import { appWindowMeta } from "@/organisms/app-window/meta";
import { paneMeta } from "@/organisms/pane/meta";
import { railMeta } from "@/organisms/rail/meta";
import { sidePanelMeta } from "@/organisms/side-panel/meta";
import { statusBarMeta } from "@/organisms/status-bar/meta";
import { tabBarMeta } from "@/organisms/tab-bar/meta";
import { titleBarMeta } from "@/organisms/title-bar/meta";
import { emptyStateMeta } from "@/organisms/empty-state/meta";
import { modalMeta } from "@/organisms/modal/meta";
import { popoverMeta } from "@/organisms/popover/meta";
import { toastMeta } from "@/organisms/toast/meta";
import { toolbarMeta } from "@/organisms/toolbar/meta";

export const REGISTRY: ComponentMeta[] = [
  agentIconMeta,
  badgeMeta,
  barMeta,
  buttonMeta,
  chipMeta,
  dotMeta,
  kbdMeta,
  pillMeta,
  spinnerMeta,
  surfaceMeta,
  switchMeta,
  cardMeta,
  fieldMeta,
  listRowMeta,
  meterMeta,
  segmentedMeta,
  statePillMeta,
  tooltipMeta,
  appWindowMeta,
  emptyStateMeta,
  paneMeta,
  railMeta,
  sidePanelMeta,
  statusBarMeta,
  tabBarMeta,
  titleBarMeta,
  modalMeta,
  popoverMeta,
  toastMeta,
  toolbarMeta,
];
