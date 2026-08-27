import { describe, expect, it } from "vitest";
import type { AcpEntry } from "@/bindings/AcpEntry";
import type { AcpPermission } from "@/bindings/AcpPermission";
import { laidOut } from "@/features/acp/state";

function ask(request: number, group: string | null, at: number, of: number): AcpPermission {
  return { request, title: `q${request}`, decided: null, group, at, of, options: [] };
}

function entry(index: number, body: AcpEntry["body"]): AcpEntry {
  return { index, at: 0, body };
}

function said(index: number): AcpEntry {
  return entry(index, { type: "agent", text: "hola" });
}

function asked(index: number, one: AcpPermission): AcpEntry {
  return entry(index, { type: "permission", ask: one });
}

describe("laying the transcript out", () => {
  it("leaves anything that is not a question alone", () => {
    const shown = laidOut([said(0), said(1)]);
    expect(shown.map((one) => one.kind)).toEqual(["entry", "entry"]);
  });

  it("gathers the questions that came from one call", () => {
    const shown = laidOut([
      said(0),
      asked(1, ask(1, "call-1", 0, 3)),
      asked(2, ask(2, "call-1", 1, 3)),
      asked(3, ask(3, "call-1", 2, 3)),
    ]);

    expect(shown).toHaveLength(2);
    const group = shown[1];
    expect(group.kind).toBe("ask");
    if (group.kind === "ask") {
      expect(group.asks.map((one) => one.request)).toEqual([1, 2, 3]);
    }
  });

  it("puts them back in the order the agent asked them", () => {
    const shown = laidOut([asked(0, ask(9, "call-1", 2, 3)), asked(1, ask(7, "call-1", 0, 3))]);
    const group = shown[0];
    if (group.kind !== "ask") {
      throw new Error("expected one group");
    }
    expect(group.asks.map((one) => one.at)).toEqual([0, 2]);
  });

  it("keeps two different calls apart", () => {
    const shown = laidOut([asked(0, ask(1, "call-1", 0, 1)), asked(1, ask(2, "call-2", 0, 1))]);
    expect(shown).toHaveLength(2);
  });

  it("does not gather questions that carry no group at all", () => {
    const shown = laidOut([asked(0, ask(1, null, 0, 0)), asked(1, ask(2, null, 0, 0))]);
    expect(shown).toHaveLength(2);
  });

  it("breaks a group when something else lands between", () => {
    const shown = laidOut([
      asked(0, ask(1, "call-1", 0, 2)),
      said(1),
      asked(2, ask(2, "call-1", 1, 2)),
    ]);
    expect(shown.map((one) => one.kind)).toEqual(["ask", "entry", "ask"]);
  });
});
