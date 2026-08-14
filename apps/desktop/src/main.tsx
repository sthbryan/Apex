import { render } from "preact";

import { App } from "@/app/App";
import "@/shared/theme";

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root node");
}

render(<App />, root);
