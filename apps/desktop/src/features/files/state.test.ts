import { describe, expect, it } from "vitest";
import { fileName, formatSize, isStaleWrite, isSvg, svgSource } from "./state";

describe("fileName", () => {
  it("returns the last segment", () => {
    expect(fileName("a/b/c.ts")).toBe("c.ts");
    expect(fileName("file.txt")).toBe("file.txt");
    expect(fileName("")).toBe("");
  });
});

describe("formatSize", () => {
  it("formats bytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(10240)).toBe("10 KB");
  });

  it("formats megabytes and gigabytes", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(1024 * 1024 * 1024)).toBe("1.0 GB");
    expect(formatSize(1024 * 1024 * 1024 * 2)).toBe("2.0 GB");
  });
});

describe("isSvg", () => {
  it("detects svg extension case-insensitive", () => {
    expect(isSvg("icon.svg")).toBe(true);
    expect(isSvg("ICON.SVG")).toBe(true);
    expect(isSvg("photo.png")).toBe(false);
  });
});

describe("svgSource", () => {
  it("encodes svg as data uri", () => {
    expect(svgSource("<svg></svg>")).toBe("data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E");
  });
});

describe("isStaleWrite", () => {
  it("detects conflict prefix", () => {
    expect(isStaleWrite("Conflict: file changed")).toBe(true);
    expect(isStaleWrite("other error")).toBe(false);
    expect(isStaleWrite(new Error("other"))).toBe(false);
  });
});
