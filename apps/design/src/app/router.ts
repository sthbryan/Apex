import { signal } from "@preact/signals";

export type Route = "/" | "/toolkit";

function parse(pathname: string): Route {
  return pathname === "/toolkit" ? "/toolkit" : "/";
}

export const route = signal<Route>(parse(location.pathname));

export function navigate(to: Route) {
  history.pushState(null, "", to);
  route.value = to;
}

addEventListener("popstate", () => {
  route.value = parse(location.pathname);
});
