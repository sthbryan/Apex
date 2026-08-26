import { describe, expect, it } from "vitest";

import type { ApiRun } from "@/bindings/ApiRun";

import { runHeaders, shownBody } from "./run";

function run(over: Partial<ApiRun> = {}): ApiRun {
  return {
    name: "me",
    method: "GET",
    url: "http://localhost:3000/me",
    status: 200,
    millis: 5,
    at: 0,
    headers: [],
    body: "hi",
    truncated: false,
    size: 2,
    ...over,
  };
}

describe("runHeaders", () => {
  it("turns the pairs that came over the wire into rows", () => {
    expect(runHeaders(run({ headers: [["content-type", "application/json"]] }))).toEqual([
      { key: "content-type", value: "application/json" },
    ]);
  });
});

describe("shownBody", () => {
  it("lays out json that came back on one line", () => {
    expect(shownBody(run({ body: '{"a":1}' }))).toEqual({ text: '{\n  "a": 1\n}', json: true });
  });

  it("leaves a body that is not json alone", () => {
    expect(shownBody(run({ body: "<html>" }))).toEqual({ text: "<html>", json: false });
  });

  it("marks a body that was cut and does not try to lay it out", () => {
    expect(shownBody(run({ body: '{"a":1', truncated: true }))).toEqual({
      text: '{"a":1\n\n...',
      json: false,
    });
  });

  it("counts a bare json value as json", () => {
    expect(shownBody(run({ body: "42" }))).toEqual({ text: "42", json: true });
  });
});
