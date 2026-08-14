import { render } from "preact";

import { App } from "./App";
import "./theme/tokens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("missing #root node");
}

render(<App />, root);
