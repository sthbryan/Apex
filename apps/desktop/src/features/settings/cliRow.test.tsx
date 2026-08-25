import { beforeEach, describe, expect, it } from "vitest";
import { cli } from "@/features/settings/cli";
import { daemonSection } from "@/features/settings/sections";

function hintOf(): string {
  const row = daemonSection().entries.find((entry) => entry.id === "cli");
  if (!row) {
    throw new Error("the cli row is missing");
  }
  return row.hint ?? "";
}

beforeEach(() => {
  cli.value = null;
});

describe("the apex command row", () => {
  it("invites you to install it before anything is known", () => {
    expect(hintOf()).toContain("apex status");
  });

  it("keeps inviting you when nothing is linked", () => {
    cli.value = {
      path: "/home/me/.local/bin/apex",
      linked: false,
      occupied: false,
      on_path: false,
    };

    expect(hintOf()).toContain("apex status");
  });

  it("says where it landed once it works", () => {
    cli.value = { path: "/home/me/.local/bin/apex", linked: true, occupied: false, on_path: true };

    expect(hintOf()).toContain("/home/me/.local/bin/apex");
    expect(hintOf()).not.toContain("PATH");
  });

  it("hands you the export line when the folder is off your path", () => {
    cli.value = {
      path: "/home/me/.local/bin/apex",
      linked: true,
      occupied: false,
      on_path: false,
    };

    expect(hintOf()).toContain("PATH");
    expect(hintOf()).toContain("/home/me/.local/bin");
  });

  it("warns instead of offering when someone else holds the name", () => {
    cli.value = { path: "/home/me/.local/bin/apex", linked: false, occupied: true, on_path: false };

    expect(hintOf()).toContain("already taken");
  });
});
