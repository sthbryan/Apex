import { describe, expect, it } from "vitest";

import { readPairs, readParams, writePairs, writeParams } from "./url";

describe("readPairs", () => {
  it("splits on the first equals so a value may hold its own", () => {
    expect(readPairs("q=a=b")).toEqual([{ key: "q", value: "a=b" }]);
  });

  it("reads a key with no equals as an empty value", () => {
    expect(readPairs("flag")).toEqual([{ key: "flag", value: "" }]);
  });

  it("drops the empty pieces a stray ampersand leaves behind", () => {
    expect(readPairs("a=1&&b=2")).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "2" },
    ]);
  });

  it("reads nothing out of an empty string", () => {
    expect(readPairs("")).toEqual([]);
  });
});

describe("writePairs", () => {
  it("drops a pair that has no key", () => {
    expect(writePairs([{ key: "", value: "1" }, { key: "b", value: "2" }])).toBe("b=2");
  });

  it("writes a bare key when the value is empty", () => {
    expect(writePairs([{ key: "flag", value: "" }])).toBe("flag");
  });

  it("joins the pairs with an ampersand", () => {
    expect(writePairs([{ key: "a", value: "1" }, { key: "b", value: "2" }])).toBe("a=1&b=2");
  });
});

describe("readParams", () => {
  it("finds nothing when the url has no query", () => {
    expect(readParams("https://api.dev/users")).toEqual([]);
  });

  it("leaves a variable alone instead of encoding it", () => {
    expect(readParams("https://{{host}}/users?tag={{tag}}")).toEqual([
      { key: "tag", value: "{{tag}}" },
    ]);
  });

  it("stops the query at the hash", () => {
    expect(readParams("https://api.dev/users?a=1#top")).toEqual([{ key: "a", value: "1" }]);
  });
});

describe("writeParams", () => {
  it("puts the query back on the url", () => {
    expect(writeParams("https://api.dev/users", [{ key: "a", value: "1" }])).toBe(
      "https://api.dev/users?a=1",
    );
  });

  it("replaces the query that was already there", () => {
    expect(writeParams("https://api.dev/users?a=1", [{ key: "b", value: "2" }])).toBe(
      "https://api.dev/users?b=2",
    );
  });

  it("takes the question mark away with the last param", () => {
    expect(writeParams("https://api.dev/users?a=1", [])).toBe("https://api.dev/users");
  });

  it("keeps the hash behind the query", () => {
    expect(writeParams("https://api.dev/users?a=1#top", [{ key: "b", value: "2" }])).toBe(
      "https://api.dev/users?b=2#top",
    );
  });

  it("keeps the hash when the last param leaves", () => {
    expect(writeParams("https://api.dev/users?a=1#top", [])).toBe("https://api.dev/users#top");
  });

  it("round trips what it read", () => {
    const url = "https://{{host}}/users?tag={{tag}}&flag&q=a=b";
    expect(writeParams(url, readParams(url))).toBe(url);
  });
});
