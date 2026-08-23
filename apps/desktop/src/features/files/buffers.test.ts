import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bufferKey, buffers, dirtyKeys, dropBuffer, keepBuffer, readBuffer } from "./buffers";

beforeEach(() => {
  buffers.value = {};
  vi.useFakeTimers();
  vi.setSystemTime(1000);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bufferKey", () => {
  it("keeps the same path apart across projects", () => {
    expect(bufferKey("one", "src/a.ts")).not.toBe(bufferKey("two", "src/a.ts"));
  });
});

describe("keepBuffer", () => {
  it("hands back what was stored", () => {
    keepBuffer("p", "a.ts", "hello", "rev1");

    expect(readBuffer("p", "a.ts")).toMatchObject({ text: "hello", revision: "rev1" });
  });

  it("has nothing to say about a file never edited", () => {
    expect(readBuffer("p", "ghost.ts")).toBeNull();
  });

  it("keeps the first edit time when the same file is written again", () => {
    keepBuffer("p", "a.ts", "one", null);
    vi.setSystemTime(9000);
    keepBuffer("p", "a.ts", "two", null);

    expect(readBuffer("p", "a.ts")).toMatchObject({ text: "two", opened: 1000 });
  });
});

describe("dropBuffer", () => {
  it("forgets the file", () => {
    keepBuffer("p", "a.ts", "one", null);
    dropBuffer("p", "a.ts");

    expect(readBuffer("p", "a.ts")).toBeNull();
  });

  it("leaves the pool untouched when there was nothing to drop", () => {
    keepBuffer("p", "a.ts", "one", null);
    const before = buffers.value;
    dropBuffer("p", "ghost.ts");

    expect(buffers.value).toBe(before);
  });
});

describe("dirtyKeys", () => {
  it("follows what is being held", () => {
    keepBuffer("p", "a.ts", "one", null);

    expect(dirtyKeys.value.has(bufferKey("p", "a.ts"))).toBe(true);

    dropBuffer("p", "a.ts");

    expect(dirtyKeys.value.size).toBe(0);
  });
});

describe("the pool", () => {
  it("throws out the oldest edit once it is full", () => {
    for (let index = 0; index < 65; index += 1) {
      vi.setSystemTime(1000 + index);
      keepBuffer("p", `file-${index}.ts`, "x", null);
    }

    expect(Object.keys(buffers.value)).toHaveLength(64);
    expect(readBuffer("p", "file-0.ts")).toBeNull();
    expect(readBuffer("p", "file-1.ts")).not.toBeNull();
    expect(readBuffer("p", "file-64.ts")).not.toBeNull();
  });

  it("does not evict while there is still room", () => {
    for (let index = 0; index < 64; index += 1) {
      vi.setSystemTime(1000 + index);
      keepBuffer("p", `file-${index}.ts`, "x", null);
    }

    expect(Object.keys(buffers.value)).toHaveLength(64);
    expect(readBuffer("p", "file-0.ts")).not.toBeNull();
  });
});
