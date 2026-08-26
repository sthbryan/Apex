import { signal } from "@preact/signals";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@/features/projects/state", () => ({
  activeProjectId: signal<string | null>("p1"),
}));

vi.mock("@/shared/daemon", () => ({
  complain: () => {},
}));

import { activeProjectId } from "@/features/projects/state";
import {
  blank,
  brokenJson,
  chosen,
  dirty,
  draft,
  edit,
  environment,
  environments,
  fields,
  headers,
  last,
  loadCollection,
  names,
  openRequest,
  params,
  saved,
  sending,
  sendRequest,
  setEnvironment,
  setFields,
  setHeaders,
  setKind,
  setParams,
  startNew,
  tone,
  trouble,
} from "./state";

const RUN = {
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
};

beforeEach(() => {
  invoke.mockReset();
  localStorage.clear();
  (activeProjectId as unknown as { value: string | null }).value = "p1";
  startNew();
  names.value = [];
  environments.value = [];
  environment.value = null;
});

describe("loadCollection", () => {
  it("keeps the names and the environments", async () => {
    invoke.mockResolvedValue({ requests: ["a", "b"], environments: ["local"] });
    await loadCollection();
    expect(names.value).toEqual(["a", "b"]);
    expect(environments.value).toEqual(["local"]);
  });

  it("drops a remembered environment that is gone", async () => {
    setEnvironment("staging");
    invoke.mockResolvedValue({ requests: [], environments: ["local"] });
    await loadCollection();
    expect(environment.value).toBe("local");
  });

  it("asks for nothing without a project", async () => {
    (activeProjectId as unknown as { value: string | null }).value = null;
    names.value = ["stale"];
    await loadCollection();
    expect(invoke).not.toHaveBeenCalled();
    expect(names.value).toEqual([]);
  });
});

describe("openRequest", () => {
  it("loads the request and the run beside it", async () => {
    const request = { method: "POST", url: "http://x", headers: {}, body: null };
    invoke.mockResolvedValue({ request, last: RUN });
    await openRequest("me");
    expect(chosen.value).toBe("me");
    expect(draft.value).toEqual(request);
    expect(last.value).toEqual(RUN);
    expect(dirty()).toBe(false);
  });
});

describe("dirty", () => {
  it("is false with nothing chosen", () => {
    edit({ url: "http://x" });
    expect(dirty()).toBe(false);
  });

  it("turns true once the draft leaves the saved copy", () => {
    chosen.value = "me";
    saved.value = blank();
    draft.value = blank();
    expect(dirty()).toBe(false);
    edit({ url: "http://x" });
    expect(dirty()).toBe(true);
  });
});

describe("headers", () => {
  it("reads the rows back in the order they were written", () => {
    setHeaders([
      { key: "Accept", value: "application/json" },
      { key: "X-Trace", value: "1" },
    ]);
    expect(headers()).toEqual([
      { key: "Accept", value: "application/json" },
      { key: "X-Trace", value: "1" },
    ]);
  });

  it("leaves out a row that has no name", () => {
    setHeaders([{ key: "", value: "text/plain" }]);
    expect(draft.value.headers).toEqual({});
  });
});

describe("params", () => {
  it("writes the rows into the url and reads them back", () => {
    edit({ url: "https://{{host}}/users" });
    setParams([{ key: "tag", value: "{{tag}}" }]);
    expect(draft.value.url).toBe("https://{{host}}/users?tag={{tag}}");
    expect(params()).toEqual([{ key: "tag", value: "{{tag}}" }]);
  });
});

describe("fields", () => {
  it("writes the rows into the body and reads them back", () => {
    setFields([{ key: "a", value: "1" }]);
    expect(draft.value.body).toBe("a=1");
    expect(fields()).toEqual([{ key: "a", value: "1" }]);
  });
});

describe("setKind", () => {
  it("sets the content type the kind asks for", () => {
    setKind("json");
    expect(draft.value.headers).toEqual({ "Content-Type": "application/json" });
    expect(draft.value.body).toBe("");
  });

  it("takes the body and its header away again", () => {
    setKind("json");
    setKind("none");
    expect(draft.value.headers).toEqual({});
    expect(draft.value.body).toBe(null);
  });
});

describe("sendRequest", () => {
  it("saves an edited draft before sending it", async () => {
    chosen.value = "me";
    saved.value = blank();
    draft.value = { ...blank(), url: "http://x" };
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce(RUN);
    await sendRequest();
    expect(invoke.mock.calls[0][0]).toBe("api_write");
    expect(invoke.mock.calls[1][0]).toBe("api_send");
    expect(last.value).toEqual(RUN);
  });

  it("sends straight through when nothing changed", async () => {
    chosen.value = "me";
    saved.value = blank();
    draft.value = blank();
    invoke.mockResolvedValue(RUN);
    await sendRequest();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe("api_send");
  });

  it("keeps the complaint instead of throwing", async () => {
    chosen.value = "me";
    saved.value = blank();
    draft.value = blank();
    invoke.mockRejectedValue("nothing answered at that address");
    await sendRequest();
    expect(trouble.value).toContain("nothing answered");
    expect(last.value).toBeNull();
  });

  it("does nothing without a request chosen", async () => {
    await sendRequest();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("holds back a json body that will not parse", async () => {
    chosen.value = "me";
    saved.value = blank();
    draft.value = { ...blank(), headers: { "Content-Type": "application/json" }, body: '{"a":}' };
    await sendRequest();
    expect(invoke).not.toHaveBeenCalled();
    expect(trouble.value).toContain("JSON");
    expect(sending.value).toBe(false);
  });

  it("sends a text body that is not json without a word", async () => {
    chosen.value = "me";
    saved.value = blank();
    draft.value = { ...blank(), headers: { "Content-Type": "text/plain" }, body: "hello" };
    invoke.mockResolvedValue(RUN);
    await sendRequest();
    expect(invoke).toHaveBeenCalled();
    expect(trouble.value).toBeNull();
  });
});

describe("brokenJson", () => {
  it("says nothing about a body that is not json", () => {
    draft.value = { ...blank(), headers: { "Content-Type": "text/plain" }, body: "{" };
    expect(brokenJson()).toBe(null);
  });

  it("points at the json that will not parse", () => {
    draft.value = { ...blank(), headers: { "Content-Type": "application/json" }, body: "{" };
    expect(brokenJson()).not.toBe(null);
  });
});

describe("reading a run", () => {
  it("tells the status apart", () => {
    expect(tone(200)).toBe("ok");
    expect(tone(301)).toBe("warn");
    expect(tone(404)).toBe("bad");
    expect(tone(500)).toBe("bad");
  });
});
