import { render } from "preact";
import { App } from "./App";
import { applyTheme } from "@/shared/theme/mode";
import "@/shared/theme/index.css";

applyTheme(document.documentElement);

render(<App />, document.getElementById("root")!);
