import { signal } from "@preact/signals";

export const ROUTES = ["/", "/views", "/toolkit"] as const;

export type Route = typeof ROUTES[number];

function parse(pathname: string): Route {
  return (ROUTES as readonly string[]).includes(pathname) ? pathname as Route : "/";
}

export const route = signal<Route>(parse(location.pathname));

export function navigate(to: Route) {
  history.pushState(null, "", to);
  route.value = to;
}

addEventListener("popstate", () => {
  route.value = parse(location.pathname);
});
