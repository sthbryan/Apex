import { Component, type ComponentChildren } from "preact";

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
        <div class="h-full overflow-auto bg-pane p-3">
          <p class="text-state-failed">{this.state.failure}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
