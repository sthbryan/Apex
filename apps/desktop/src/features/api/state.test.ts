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

const changed = new Set<(event: { project: string; name: string }) => void>();

vi.mock("@/features/sessions/state", () => ({
  onApiChanged: (handler: (event: { project: string; name: string }) => void) => {
    changed.add(handler);
    return () => changed.delete(handler);
  },
}));

import { activeProjectId } from "@/features/projects/state";
import {
  blank,
  brokenJson,
  catalog,
  chosen,
  closeEnvironment,
  dirty,
  draft,
  edit,
  editing,
  environment,
  environments,
  fields,
  headers,
  last,
  layOut,
  loadCollection,
  openEnvironment,
  openRequest,
  params,
  removeEnvironment,
  saved,
  saveEnvironment,
  sending,
  sendRequest,
  setEnvironment,
  setFields,
  setHeaders,
  setKind,
  setParams,
  startCollection,
  startEnvironment,
  startNew,
  tone,
  trouble,
  variables,
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
  changed.clear();
  invoke.mockReset();
  localStorage.clear();
  (activeProjectId as unknown as { value: string | null }).value = "p1";
  startNew();
  closeEnvironment();
  catalog.value = [];
  environments.value = [];
  environment.value = null;
});

describe("loadCollection", () => {
  it("keeps the requests with their verbs and the environments", async () => {
    invoke.mockResolvedValue({
      requests: [{ name: "a", method: "GET" }],
      environments: ["local"],
    });
    await loadCollection();
    expect(catalog.value).toEqual([{ name: "a", method: "GET" }]);
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
    catalog.value = [{ name: "stale", method: "GET" }];
    await loadCollection();
    expect(invoke).not.toHaveBeenCalled();
    expect(catalog.value).toEqual([]);
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

describe("layOut", () => {
  it("lays the body out in place", () => {
    setKind("json");
    edit({ body: '{"a":1}' });
    layOut();
    expect(draft.value.body).toBe('{\n  "a": 1\n}');
  });

  it("leaves a body it cannot parse alone", () => {
    setKind("json");
    edit({ body: '{"id": {{userId}}}' });
    layOut();
    expect(draft.value.body).toBe('{"id": {{userId}}}');
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

describe("environments", () => {
  it("reads the variables of the one it opens", async () => {
    invoke.mockResolvedValue([{ name: "host", value: "api.dev", secret: false }]);
    await openEnvironment("staging");
    expect(editing.value).toBe("staging");
    expect(variables.value).toEqual([{ name: "host", value: "api.dev", secret: false }]);
  });

  it("starts a new one with nothing in it", () => {
    variables.value = [{ name: "host", value: "api.dev", secret: false }];
    startEnvironment();
    expect(editing.value).toBe("");
    expect(variables.value).toEqual([]);
  });

  it("picks the environment it just saved", async () => {
    variables.value = [{ name: "host", value: "api.dev", secret: false }];
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      requests: [],
      environments: ["staging"],
    });
    await saveEnvironment("staging");
    expect(invoke.mock.calls[0][0]).toBe("api_env_write");
    expect(environment.value).toBe("staging");
    expect(editing.value).toBe(null);
  });

  it("stops using the one it deletes", async () => {
    setEnvironment("staging");
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      requests: [],
      environments: [],
    });
    await removeEnvironment("staging");
    expect(environment.value).toBe(null);
    expect(editing.value).toBe(null);
  });

  it("keeps using another one when it deletes the one beside it", async () => {
    setEnvironment("local");
    invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce({
      requests: [],
      environments: ["local"],
    });
    await removeEnvironment("staging");
    expect(environment.value).toBe("local");
  });
});

describe("startCollection", () => {
  it("reads the collection again when the daemon says it changed", async () => {
    invoke.mockResolvedValue({ requests: [{ name: "a", method: "GET" }], environments: [] });
    const stop = startCollection();
    await Promise.resolve();
    invoke.mockResolvedValue({
      requests: [
        { name: "a", method: "GET" },
        { name: "b", method: "POST" },
      ],
      environments: [],
    });
    for (const handler of changed) {
      handler({ project: "p1", name: "b" });
    }
    await Promise.resolve();
    expect(catalog.value.map((entry) => entry.name)).toEqual(["a", "b"]);
    stop();
  });

  it("leaves another project alone", async () => {
    invoke.mockResolvedValue({ requests: [{ name: "a", method: "GET" }], environments: [] });
    const stop = startCollection();
    await Promise.resolve();
    invoke.mockClear();
    for (const handler of changed) {
      handler({ project: "other", name: "b" });
    }
    expect(invoke).not.toHaveBeenCalled();
    stop();
  });

  it("reads the open request again when that is the one that changed", async () => {
    const fresh = { method: "POST", url: "http://x/new", headers: {}, body: null };
    invoke.mockImplementation((name: string) =>
      name === "api_read"
        ? Promise.resolve({ request: fresh, last: null })
        : Promise.resolve({ requests: [{ name: "b", method: "GET" }], environments: [] }),
    );
    chosen.value = "b";
    saved.value = blank();
    draft.value = blank();
    const stop = startCollection();
    for (const handler of changed) {
      handler({ project: "p1", name: "b" });
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(draft.value).toEqual(fresh);
    stop();
  });

  it("leaves an edited request alone rather than losing the edit", async () => {
    invoke.mockImplementation(() =>
      Promise.resolve({ requests: [{ name: "b", method: "GET" }], environments: [] }),
    );
    chosen.value = "b";
    saved.value = blank();
    draft.value = { ...blank(), url: "http://mine" };
    const stop = startCollection();
    for (const handler of changed) {
      handler({ project: "p1", name: "b" });
    }
    await Promise.resolve();
    await Promise.resolve();
    expect(draft.value.url).toBe("http://mine");
    stop();
  });

  it("stops listening once it is done", async () => {
    invoke.mockResolvedValue({ requests: [], environments: [] });
    startCollection()();
    expect(changed.size).toBe(0);
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
