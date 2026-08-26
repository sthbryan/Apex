import type { ApiRequest } from "@/bindings/ApiRequest";

export type BodyKind = "none" | "json" | "text" | "form";

export const KINDS: BodyKind[] = ["none", "json", "text", "form"];

const TYPES = {
  json: "application/json",
  text: "text/plain",
  form: "application/x-www-form-urlencoded",
} as const;

const VARIABLE = /\{\{[^{}]*\}\}/g;

export function bodyKind(request: ApiRequest): BodyKind {
  if (request.body === null || request.body === undefined) {
    return "none";
  }
  const key = typeKey(request.headers);
  const type = (key === undefined ? "" : request.headers[key]).split(";")[0].trim().toLowerCase();
  if (type.endsWith("json")) {
    return "json";
  }
  return type === TYPES.form ? "form" : "text";
}

export function withBodyKind(request: ApiRequest, kind: BodyKind): ApiRequest {
  if (kind === bodyKind(request)) {
    return request;
  }
  const headers = { ...request.headers };
  const key = typeKey(headers) ?? "Content-Type";
  if (kind === "none") {
    delete headers[key];
    return { ...request, headers, body: null };
  }
  headers[key] = TYPES[kind];
  return { ...request, headers, body: request.body ?? "" };
}

export function jsonTrouble(body: string): string | null {
  if (body.trim() === "") {
    return null;
  }
  try {
    JSON.parse(body.replace(VARIABLE, "1"));
    return null;
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}

function typeKey(headers: Record<string, string>): string | undefined {
  return Object.keys(headers).find((key) => key.toLowerCase() === "content-type");
}
