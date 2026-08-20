type Props = {
  url: string;
};

export function BrowserView({ url }: Props) {
  return <div class="flex h-full w-full items-center justify-center bg-pane text-faint">{url}</div>;
}
