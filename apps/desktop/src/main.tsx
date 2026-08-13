import { render } from "preact";

import { App } from "./App";
import "./theme/tokens.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("falta el nodo #root");
}

render(<App />, root);
