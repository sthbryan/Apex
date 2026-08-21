import type { ComponentChildren, ComponentType } from "preact";
import { useState } from "preact/hooks";
import { Button, Modal, Popover, Segmented, Switch, Tooltip } from "@apex/ui";
import type { ComponentVariant } from "@apex/ui";

type Harness = (variant: ComponentVariant) => ComponentChildren;

function StatefulSwitch({ variant }: { variant: ComponentVariant }) {
  const [checked, setChecked] = useState(Boolean(variant.props.checked));
  return <Switch {...(variant.props as any)} checked={checked} onChange={setChecked} />;
}

function StatefulSegmented({ variant }: { variant: ComponentVariant }) {
  const [value, setValue] = useState(String(variant.props.value));
  return <Segmented {...(variant.props as any)} value={value} onChange={setValue} />;
}

function TriggeredModal({ variant }: { variant: ComponentVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Open {String(variant.props.width ?? "md")}</Button>
      <Modal {...(variant.props as any)} open={open} onClose={() => setOpen(false)}>
        {variant.children}
      </Modal>
    </>
  );
}

function TriggeredPopover({ variant }: { variant: ComponentVariant }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      {...(variant.props as any)}
      open={open}
      onClose={() => setOpen(false)}
      anchor={<Button size="sm" onClick={() => setOpen((v) => !v)}>{variant.name}</Button>}
    >
      Nothing to report.
    </Popover>
  );
}

export const HARNESS: Record<string, Harness> = {
  Switch: (variant) => <StatefulSwitch variant={variant} />,
  Segmented: (variant) => <StatefulSegmented variant={variant} />,
  Modal: (variant) => <TriggeredModal variant={variant} />,
  Popover: (variant) => <TriggeredPopover variant={variant} />,
  Tooltip: (variant) => (
    <Tooltip {...(variant.props as any)}>
      <Button size="sm">Hover</Button>
    </Tooltip>
  ),
};

export function renderVariant(component: ComponentType<any>, name: string, variant: ComponentVariant) {
  const harness = HARNESS[name];
  if (harness) return harness(variant);
  const Component = component;
  return <Component {...variant.props}>{variant.children}</Component>;
}
