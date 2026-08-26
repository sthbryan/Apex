import { describe, expect, it } from "vitest";

import type { ApiRequest } from "@/bindings/ApiRequest";

import { bodyKind, jsonTrouble, withBodyKind } from "./body";

function request(over: Partial<ApiRequest> = {}): ApiRequest {
  return { method: "POST", url: "https://api.dev", headers: {}, body: null, ...over };
}

describe("bodyKind", () => {
  it("calls a request with no body none", () => {
    expect(bodyKind(request())).toBe("none");
  });

  it("calls an empty body text rather than none", () => {
    expect(bodyKind(request({ body: "" }))).toBe("text");
  });

  it("reads the type however the header was cased", () => {
    expect(bodyKind(request({ body: "{}", headers: { "content-TYPE": "Application/JSON" } }))).toBe(
      "json",
    );
  });

  it("ignores the charset that trails the type", () => {
    expect(
      bodyKind(request({ body: "{}", headers: { "Content-Type": "application/json; charset=utf-8" } })),
    ).toBe("json");
  });

  it("counts a vendor json type as json", () => {
    expect(
      bodyKind(request({ body: "{}", headers: { "Content-Type": "application/vnd.api+json" } })),
    ).toBe("json");
  });

  it("knows a form by its type", () => {
    expect(
      bodyKind(
        request({ body: "a=1", headers: { "Content-Type": "application/x-www-form-urlencoded" } }),
      ),
    ).toBe("form");
  });

  it("falls back to text for a type it does not handle", () => {
    expect(bodyKind(request({ body: "<x/>", headers: { "Content-Type": "text/xml" } }))).toBe("text");
  });
});

describe("withBodyKind", () => {
  it("sets the type header the kind asks for", () => {
    expect(withBodyKind(request(), "json").headers).toEqual({ "Content-Type": "application/json" });
  });

  it("gives the body somewhere to be typed", () => {
    expect(withBodyKind(request(), "json").body).toBe("");
  });

  it("keeps the body when the kind changes", () => {
    const was = request({ body: "a=1", headers: { "Content-Type": "text/plain" } });
    expect(withBodyKind(was, "form").body).toBe("a=1");
  });

  it("writes over the header that was already there instead of adding a second", () => {
    const was = request({ body: "{}", headers: { "content-type": "text/plain" } });
    expect(withBodyKind(was, "json").headers).toEqual({ "content-type": "application/json" });
  });

  it("takes the body and its header away for none", () => {
    const was = request({ body: "{}", headers: { "Content-Type": "application/json", Accept: "*/*" } });
    const now = withBodyKind(was, "none");
    expect(now.body).toBe(null);
    expect(now.headers).toEqual({ Accept: "*/*" });
  });

  it("leaves a vendor type alone when the kind did not change", () => {
    const was = request({ body: "{}", headers: { "Content-Type": "application/vnd.api+json" } });
    expect(withBodyKind(was, "json")).toBe(was);
  });

  it("leaves the request it was given untouched", () => {
    const was = request({ body: "{}", headers: { "Content-Type": "application/json" } });
    withBodyKind(was, "none");
    expect(was.headers).toEqual({ "Content-Type": "application/json" });
  });
});

describe("jsonTrouble", () => {
  it("says nothing about an empty body", () => {
    expect(jsonTrouble("   ")).toBe(null);
  });

  it("says nothing about json that parses", () => {
    expect(jsonTrouble('{"a": [1, 2]}')).toBe(null);
  });

  it("reads a variable standing in for a number", () => {
    expect(jsonTrouble('{"id": {{userId}}}')).toBe(null);
  });

  it("reads a variable standing inside a string", () => {
    expect(jsonTrouble('{"name": "hi {{who}}"}')).toBe(null);
  });

  it("complains about a trailing comma", () => {
    expect(jsonTrouble('{"a": 1,}')).not.toBe(null);
  });

  it("complains about a body that is not json at all", () => {
    expect(jsonTrouble("hello")).not.toBe(null);
  });
});
