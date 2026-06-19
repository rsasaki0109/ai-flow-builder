// @vitest-environment jsdom

import type { FlowResource } from "@ai-flow-builder/flow-core";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import {
  AUTOSAVE_DEBOUNCE_MS,
  saveFlowResource,
  useEditorAutosave,
  type AutosaveRequest,
  type AutosaveResult,
  type SaveFlow,
} from "./use-editor-autosave.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useEditorAutosave", () => {
  it("saves dirty editor state after the debounce window", async () => {
    vi.useFakeTimers();
    const save = createQueuedSaveFlow();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <AutosaveProbe saveFlow={save.fn} />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename node" }));
    expect(screen.getByTestId("save-status").textContent).toBe("dirty");

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS - 1);
    });
    expect(save.requests).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(save.requests).toHaveLength(1);
    expect(save.requests[0]).toMatchObject({
      expectedRevision: 1,
      flowId: "10000000-0000-4000-8000-000000000001",
    });
    expect(save.requests[0]?.graph.nodes[0]?.label).toBe("Renamed Node");
    expect(screen.getByTestId("save-status").textContent).toBe("saving");

    await act(async () => {
      save.resolveNext({
        flow: createSavedFlowFromRequest(save.requests[0], 2),
        status: "saved",
      });
    });

    expect(screen.getByTestId("save-status").textContent).toBe("saved");
    expect(screen.getByTestId("server-revision").textContent).toBe("2");
    expect(screen.getByTestId("dirty").textContent).toBe("clean");
  });

  it("runs one in-flight save and immediately saves pending edits after it completes", async () => {
    vi.useFakeTimers();
    const save = createQueuedSaveFlow();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <AutosaveProbe saveFlow={save.fn} />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename node" }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(save.requests).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rename node again" }));
    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(save.requests).toHaveLength(1);

    await act(async () => {
      save.resolveNext({
        flow: createSavedFlowFromRequest(save.requests[0], 2),
        status: "saved",
      });
    });

    expect(save.requests).toHaveLength(2);
    expect(save.requests[1]).toMatchObject({
      expectedRevision: 2,
    });
    expect(save.requests[1]?.graph.nodes[0]?.label).toBe("Renamed Again");

    await act(async () => {
      save.resolveNext({
        flow: createSavedFlowFromRequest(save.requests[1], 3),
        status: "saved",
      });
    });

    expect(screen.getByTestId("save-status").textContent).toBe("saved");
    expect(screen.getByTestId("server-revision").textContent).toBe("3");
    expect(screen.getByTestId("node-label").textContent).toBe("Renamed Again");
  });

  it("halts autosave on revision conflicts until the next edit", async () => {
    vi.useFakeTimers();
    const save = createQueuedSaveFlow();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <AutosaveProbe saveFlow={save.fn} />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename node" }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });

    await act(async () => {
      save.resolveNext({
        currentRevision: 7,
        status: "conflict",
      });
    });

    expect(screen.getByTestId("save-status").textContent).toBe("conflict");
    expect(screen.getByTestId("conflict-revision").textContent).toBe("7");

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(save.requests).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rename node again" }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });

    expect(save.requests).toHaveLength(2);
  });

  it("does not retry failed saves until a later edit marks the editor dirty again", async () => {
    vi.useFakeTimers();
    const save = createQueuedSaveFlow();

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <AutosaveProbe saveFlow={save.fn} />
      </EditorStoreProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename node" }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });

    await act(async () => {
      save.rejectNext(new Error("network"));
    });

    expect(screen.getByTestId("save-status").textContent).toBe("error");

    act(() => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(save.requests).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Rename node again" }));
    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(save.requests).toHaveLength(2);
  });

  it("sends flow updates through the default autosave client", async () => {
    const flow = createFlowResource({ revision: 2 });
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          data: flow,
        },
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveFlowResource(
      createAutosaveRequest({ expectedRevision: 1 }),
      new AbortController().signal,
    );

    expect(result).toEqual({
      flow,
      status: "saved",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows/10000000-0000-4000-8000-000000000001",
      expect.objectContaining({
        method: "PUT",
      }),
    );
  });

  it("maps default autosave client revision conflicts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "FLOW_REVISION_CONFLICT",
              details: {
                currentRevision: 9,
              },
              message: "The flow was updated by another request.",
              requestId: "10000000-0000-4000-8000-000000000999",
            },
          },
          { status: 409 },
        ),
      ),
    );

    await expect(
      saveFlowResource(
        createAutosaveRequest({ expectedRevision: 1 }),
        new AbortController().signal,
      ),
    ).resolves.toEqual({
      currentRevision: 9,
      status: "conflict",
    });
  });
});

function AutosaveProbe({ saveFlow }: { saveFlow: SaveFlow }) {
  useEditorAutosave({ saveFlow });

  const conflictRevision = useEditorStore((store) => store.conflictRevision);
  const dirty = useEditorStore((store) => store.dirty);
  const node = useEditorStore((store) => store.graph.nodes[0]);
  const saveStatus = useEditorStore((store) => store.saveStatus);
  const serverRevision = useEditorStore((store) => store.serverRevision);
  const updateNodeLabel = useEditorStore((store) => store.updateNodeLabel);

  if (node === undefined) {
    throw new Error("AutosaveProbe requires one node.");
  }

  return (
    <div>
      <span data-testid="conflict-revision">{conflictRevision ?? "none"}</span>
      <span data-testid="dirty">{dirty ? "dirty" : "clean"}</span>
      <span data-testid="node-label">{node.label}</span>
      <span data-testid="save-status">{saveStatus}</span>
      <span data-testid="server-revision">{serverRevision}</span>
      <button
        onClick={() => {
          updateNodeLabel(node.id, "Renamed Node");
        }}
        type="button"
      >
        Rename node
      </button>
      <button
        onClick={() => {
          updateNodeLabel(node.id, "Renamed Again");
        }}
        type="button"
      >
        Rename node again
      </button>
    </div>
  );
}

function createQueuedSaveFlow(): {
  fn: SaveFlow;
  rejectNext: (error: unknown) => void;
  requests: AutosaveRequest[];
  resolveNext: (result: AutosaveResult) => void;
} {
  const requests: AutosaveRequest[] = [];
  const deferredResults: Deferred<AutosaveResult>[] = [];

  return {
    fn(request) {
      const deferred = createDeferred<AutosaveResult>();
      requests.push(request);
      deferredResults.push(deferred);
      return deferred.promise;
    },
    rejectNext(error) {
      const deferred = deferredResults.shift();
      if (deferred === undefined) {
        throw new Error("No pending save to reject.");
      }
      deferred.reject(error);
    },
    requests,
    resolveNext(result) {
      const deferred = deferredResults.shift();
      if (deferred === undefined) {
        throw new Error("No pending save to resolve.");
      }
      deferred.resolve(result);
    },
  };
}

function createSavedFlowFromRequest(
  request: AutosaveRequest | undefined,
  revision: number,
): FlowResource {
  if (request === undefined) {
    throw new Error("Expected an autosave request.");
  }

  return createFlowResource({
    graph: request.graph,
    revision,
  });
}

function createAutosaveRequest(
  overrides: Partial<AutosaveRequest> = {},
): AutosaveRequest {
  const flow = createFlowResource();

  return {
    description: flow.description,
    expectedRevision: flow.revision,
    flowId: flow.id,
    graph: flow.graph,
    name: flow.name,
    ...overrides,
  };
}

interface Deferred<TValue> {
  promise: Promise<TValue>;
  reject: (reason: unknown) => void;
  resolve: (value: TValue) => void;
}

function createDeferred<TValue>(): Deferred<TValue> {
  let rejectPromise: (reason: unknown) => void = () => {};
  let resolvePromise: (value: TValue) => void = () => {};
  const promise = new Promise<TValue>((resolve, reject) => {
    rejectPromise = reject;
    resolvePromise = resolve;
  });

  return {
    promise,
    reject: rejectPromise,
    resolve: resolvePromise,
  };
}

function createFlowResource(
  overrides: Partial<FlowResource> = {},
): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Autosave Test Flow",
    description: null,
    graph: {
      schemaVersion: 1,
      nodes: [
        {
          config: {
            key: "input",
            label: "Input",
            required: true,
          },
          id: "10000000-0000-4000-8000-000000000101",
          kind: "core.input.text",
          label: "Text Input",
          position: { x: 0, y: 0 },
          specVersion: 1,
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    revision: 1,
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:00.000Z",
    ...overrides,
  };
}
