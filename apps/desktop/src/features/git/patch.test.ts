import { describe, expect, it } from "vitest";
import { binary, binaryPaths, parsePatch, splitMarkup, splittable } from "./patch";

const PATCH = `diff --git a/src/one.ts b/src/one.ts
--- a/src/one.ts
+++ b/src/one.ts
@@ -1,4 +1,4 @@
 const kept = 1;
-const gone = 2;
+const fresh = 2;
 const also = 3;
`;

describe("parsePatch", () => {
  it("pairs a removal with the addition facing it", () => {
    const [file] = parsePatch(PATCH);

    expect(file.path).toBe("src/one.ts");
    expect(file.hunks[0].rows.map((row) => row.kind)).toEqual(["same", "mod", "same"]);
  });

  it("numbers both sides from the hunk header", () => {
    const rows = parsePatch(PATCH)[0].hunks[0].rows;

    expect(rows[0].left?.no).toBe(1);
    expect(rows[1].left?.no).toBe(2);
    expect(rows[1].right?.no).toBe(2);
    expect(rows[2].left?.no).toBe(3);
  });

  it("leaves the far side empty when a block only adds", () => {
    const [file] = parsePatch(`diff --git a/a.ts b/a.ts
+++ b/a.ts
@@ -1,1 +1,3 @@
 kept
+one
+two
`);
    const rows = file.hunks[0].rows;

    expect(rows.map((row) => row.kind)).toEqual(["same", "add", "add"]);
    expect(rows[1].left).toBeNull();
    expect(rows[1].right?.no).toBe(2);
    expect(rows[2].right?.no).toBe(3);
  });

  it("turns a longer removal into modifications plus a bare deletion", () => {
    const [file] = parsePatch(`diff --git a/a.ts b/a.ts
+++ b/a.ts
@@ -1,2 +1,1 @@
-one
-two
+uno
`);

    expect(file.hunks[0].rows.map((row) => row.kind)).toEqual(["mod", "del"]);
  });

  it("keeps every file of a patch apart", () => {
    const files = parsePatch(`${PATCH}diff --git a/src/two.ts b/src/two.ts
+++ b/src/two.ts
@@ -10,1 +10,1 @@
-old
+new
`);

    expect(files.map((file) => file.path)).toEqual(["src/one.ts", "src/two.ts"]);
    expect(files[1].hunks[0].rows[0].left?.no).toBe(10);
  });

  it("drops a file that carries no hunk", () => {
    expect(parsePatch("diff --git a/a.ts b/a.ts\n+++ b/a.ts\n")).toEqual([]);
  });

  it("ignores the no-newline marker", () => {
    const [file] = parsePatch(`diff --git a/a.ts b/a.ts
+++ b/a.ts
@@ -1,1 +1,1 @@
-one
+two
\\ No newline at end of file
`);

    expect(file.hunks[0].rows).toHaveLength(1);
  });

  it("reads several hunks of the same file", () => {
    const [file] = parsePatch(`diff --git a/a.ts b/a.ts
+++ b/a.ts
@@ -1,1 +1,1 @@
-one
+uno
@@ -40,1 +40,1 @@
-two
+dos
`);

    expect(file.hunks).toHaveLength(2);
    expect(file.hunks[1].rows[0].left?.no).toBe(40);
  });
});

describe("splittable", () => {
  it("says yes only when there is a hunk to lay side by side", () => {
    expect(splittable(PATCH)).toBe(true);
    expect(splittable("diff --git a/a.png b/a.png\nBinary files differ\n")).toBe(false);
  });
});

describe("binaryPaths", () => {
  it("names the files git refused to diff", () => {
    const patch = `diff --git a/logo.png b/logo.png
Binary files a/logo.png and b/logo.png differ
${PATCH}`;

    expect(binary(patch)).toBe(true);
    expect(binaryPaths(patch)).toEqual(["logo.png"]);
  });

  it("finds nothing in a plain text patch", () => {
    expect(binary(PATCH)).toBe(false);
    expect(binaryPaths(PATCH)).toEqual([]);
  });
});

describe("splitMarkup", () => {
  it("cuts a plain string on its newlines", () => {
    expect(splitMarkup("one\ntwo")).toEqual(["one", "two"]);
  });

  it("closes and reopens a span that straddles a newline", () => {
    expect(splitMarkup('<span class="k">one\ntwo</span>')).toEqual([
      '<span class="k">one</span>',
      '<span class="k">two</span>',
    ]);
  });

  it("reopens every level of nesting", () => {
    expect(splitMarkup("<span><em>a\nb</em></span>")).toEqual([
      "<span><em>a</em></span>",
      "<span><em>b</em></span>",
    ]);
  });

  it("leaves a span that closes on its own line alone", () => {
    expect(splitMarkup("<span>a</span>\nb")).toEqual(["<span>a</span>", "b"]);
  });
});
