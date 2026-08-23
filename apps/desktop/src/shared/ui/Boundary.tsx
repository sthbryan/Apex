import { EmptyState } from "@apex/ui";
import { Component, type ComponentChildren } from "preact";
import { t } from "@/shared/i18n";

type Props = {
  children: ComponentChildren;
};

type State = {
  failure: string | null;
};

export class Boundary extends Component<Props, State> {
  state: State = { failure: null };

  static getDerivedStateFromError(cause: unknown): State {
    return { failure: cause instanceof Error ? cause.message : String(cause) };
  }

  componentDidCatch(cause: unknown) {
    console.error("a pane crashed", cause);
  }

  render() {
    if (this.state.failure !== null) {
      return (
        <EmptyState class="h-full" title={t("workspace.paneCrashed")} detail={this.state.failure} />
      );
    }
    return this.props.children;
  }
}
