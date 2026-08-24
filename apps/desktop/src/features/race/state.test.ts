import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionSummary } from "@/bindings/SessionSummary";
import type { Race } from "./state";

const { mocks } = vi.hoisted(() => {
  const projectSessions = {
    value: [] as Array<{
      id: string;
      run: string | null;
      task: string | null;
      agent: string;
      started_at: number;
      state: string;
      exit_code: number | null;
    }>,
  };
  const pending = { value: [] as Array<{ target: { type: string; id: string } }> };
  return {
    mocks: {
      projectSessions,
      pending,
      openReview: vi.fn(),
      finishClose: vi.fn(),
      complain: vi.fn(),
    },
  };
});

vi.mock("@/features/projects/state", () => ({
  projectSessions: mocks.projectSessions,
}));

vi.mock("@/features/git/state", () => ({
  pending: mocks.pending,
}));

vi.mock("@/features/review/state", () => ({
  openReview: mocks.openReview,
}));

vi.mock("@/features/sessions/pending", () => ({
  finishClose: mocks.finishClose,
}));

vi.mock("@/shared/daemon", () => ({
  complain: mocks.complain,
}));

function session(
  id: string,
  run: string | null,
  overrides: Partial<{
    task: string | null;
    agent: string;
    started_at: number;
    state: string;
    exit_code: number | null;
  }> = {},
) {
  return {
    id,
    run,
    task: null,
    agent: "claude",
    started_at: 1000,
    state: "idle",
    exit_code: null,
    ...overrides,
  };
}

async function loadModule() {
  vi.resetModules();
  const mod = await import("./state");
  return mod;
}

beforeEach(() => {
  mocks.projectSessions.value = [];
  mocks.pending.value = [];
  mocks.openReview.mockReset();
  mocks.finishClose.mockReset();
  mocks.complain.mockReset();
});

describe("races", () => {
  it("groups sessions by run and ignores sessions without a run", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1", { agent: "a", started_at: 1 }),
      session("s2", "run-1", { agent: "b", started_at: 2 }),
      session("s3", null),
    ];
    expect(mod.races.value.map((race) => race.id)).toEqual(["run-1"]);
    expect(mod.races.value[0].contenders.map((contender) => contender.id)).toEqual(["s1", "s2"]);
  });

  it("filters out races with a single contender", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [session("s1", "run-1"), session("s2", "run-2")];
    expect(mod.races.value).toHaveLength(0);
  });

  it("sorts races by startedAt descending", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1", { started_at: 1 }),
      session("s2", "run-1", { started_at: 2 }),
      session("s3", "run-2", { started_at: 3 }),
      session("s4", "run-2", { started_at: 4 }),
    ];
    const ids = mod.races.value.map((race) => race.id);
    expect(ids).toEqual(["run-2", "run-1"]);
  });

  it("prefers a task name from any contender", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1", { task: null }),
      session("s2", "run-1", { task: "test" }),
    ];
    expect(mod.races.value[0].task).toBe("test");
  });

  it("uses the earliest startedAt as the race timestamp", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1", { started_at: 5 }),
      session("s2", "run-1", { started_at: 1 }),
    ];
    expect(mod.races.value[0].startedAt).toBe(1);
  });

  it("sorts contenders by agent locale order", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1", { agent: "b" }),
      session("s2", "run-1", { agent: "a" }),
    ];
    expect(mod.races.value[0].contenders.map((contender) => contender.id)).toEqual(["s2", "s1"]);
  });
});

describe("currentRace", () => {
  it("returns the explicitly opened race", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1"),
      session("s2", "run-1"),
      session("s3", "run-2"),
      session("s4", "run-2"),
    ];
    mod.races.value;
    mod.openRace.value = "run-2";
    expect(mod.currentRace.value?.id).toBe("run-2");
  });

  it("falls back to the most recent race when nothing is opened", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [
      session("s1", "run-1", { started_at: 1 }),
      session("s2", "run-1"),
      session("s3", "run-2", { started_at: 2 }),
      session("s4", "run-2"),
    ];
    mod.openRace.value = null;
    expect(mod.currentRace.value?.id).toBe("run-2");
  });

  it("returns null when there are no races", async () => {
    const mod = await loadModule();
    expect(mod.currentRace.value).toBeNull();
  });
});

describe("raceSettled", () => {
  it("is true when every contender is done", async () => {
    const mod = await loadModule();
    const race = {
      id: "run-1",
      contenders: [session("s1", "run-1", { state: "done", exit_code: 0 })],
    } as unknown as Race;
    expect(mod.raceSettled(race)).toBe(true);
  });

  it("is true when every contender has an exit code", async () => {
    const mod = await loadModule();
    const race = {
      id: "run-1",
      contenders: [session("s1", "run-1", { state: "idle", exit_code: 1 })],
    } as unknown as Race;
    expect(mod.raceSettled(race)).toBe(true);
  });

  it("is false while at least one contender is still running without exit code", async () => {
    const mod = await loadModule();
    const race = {
      id: "run-1",
      contenders: [
        session("s1", "run-1", { state: "idle", exit_code: null }),
        session("s2", "run-1", { state: "done", exit_code: 0 }),
      ],
    } as unknown as Race;
    expect(mod.raceSettled(race)).toBe(false);
  });
});

describe("contendersOf", () => {
  it("attaches pending reviews to their contender", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [session("s1", "run-1"), session("s2", "run-1")];
    mocks.pending.value = [{ target: { type: "session", id: "s1" } }];
    const race = mod.races.value[0];
    const mapped = mod.contendersOf(race);
    expect(mapped).toHaveLength(2);
    expect(mapped.find((contender) => contender.session.id === "s1")?.changed).not.toBeNull();
    expect(mapped.find((contender) => contender.session.id === "s2")?.changed).toBeNull();
  });

  it("leaves null when there is no pending review", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [session("s1", "run-1"), session("s2", "run-1")];
    mocks.pending.value = [];
    const race = mod.races.value[0];
    const mapped = mod.contendersOf(race);
    expect(mapped.every((entry: { changed: unknown }) => entry.changed === null)).toBe(true);
  });
});

describe("contenderTarget", () => {
  it("wraps the session id as a session git target", async () => {
    const mod = await loadModule();
    expect(mod.contenderTarget(session("s1", "run-1") as unknown as SessionSummary)).toEqual({
      type: "session",
      id: "s1",
    });
  });
});

describe("settleRace", () => {
  it("closes losers and opens the winner in review", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [session("s1", "run-1"), session("s2", "run-1")];
    const race = mod.races.value[0];
    mocks.finishClose.mockResolvedValue(undefined);
    await mod.settleRace(race, "s1");
    expect(mocks.finishClose).toHaveBeenCalledWith("s2", "discard");
    expect(mocks.openReview).toHaveBeenCalledWith({ type: "session", id: "s1" });
  });

  it("clears the open race afterwards", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [session("s1", "run-1"), session("s2", "run-1")];
    const race = mod.races.value[0];
    mocks.finishClose.mockResolvedValue(undefined);
    mod.openRace.value = "run-1";
    await mod.settleRace(race, "s1");
    expect(mod.openRace.value).toBeNull();
  });

  it("complains when a loser fails to close", async () => {
    const mod = await loadModule();
    mocks.projectSessions.value = [session("s1", "run-1"), session("s2", "run-1")];
    const race = mod.races.value[0];
    mocks.finishClose.mockRejectedValue(new Error("boom"));
    await mod.settleRace(race, "s1");
    expect(mocks.complain).toHaveBeenCalled();
  });
});
