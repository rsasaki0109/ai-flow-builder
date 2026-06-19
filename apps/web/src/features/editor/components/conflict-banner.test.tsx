// @vitest-environment jsdom

import type { FlowResource } from "@ai-flow-builder/flow-core";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorStoreProvider, useEditorStore } from "../store/index.js";
import { ConflictBanner } from "./conflict-banner.js";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ConflictBanner", () => {
  it("does not render outside conflict state", () => {
    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ConflictBanner />
      </EditorStoreProvider>,
    );

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("copies the current local flow JSON", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(value: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText,
      },
    });

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ConflictStateSetter />
        <ConflictBanner />
      </EditorStoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Mark conflict" }));
    await user.click(
      screen.getByRole("button", { name: "Copy Current Flow JSON" }),
    );

    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedJson = writeText.mock.calls[0]?.[0];
    expect(typeof copiedJson).toBe("string");
    expect(JSON.parse(copiedJson as string)).toMatchObject({
      description: "Local description",
      graph: {
        nodes: [
          {
            id: "10000000-0000-4000-8000-000000000101",
            label: "Text Input",
          },
        ],
      },
      name: "Local Flow",
    });
    expect(screen.getByText("Current Flow JSON copied.")).toBeTruthy();
  });

  it("reloads the server version and clears the conflict", async () => {
    const user = userEvent.setup();
    const serverFlow = createFlowResource({
      name: "Server Flow",
      revision: 8,
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    const fetchMock = vi.fn(async () =>
      Response.json({
        data: serverFlow,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <EditorStoreProvider flow={createFlowResource()}>
        <ConflictStateSetter />
        <ConflictBanner />
        <StateProbe />
      </EditorStoreProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Mark conflict" }));
    await user.click(
      screen.getByRole("button", { name: "Reload Server Version" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows/10000000-0000-4000-8000-000000000001",
      {
        method: "GET",
      },
    );
    expect(screen.getByTestId("flow-name").textContent).toBe("Server Flow");
    expect(screen.getByTestId("save-status").textContent).toBe("saved");
    expect(screen.getByTestId("revision").textContent).toBe("8");
  });
});

function ConflictStateSetter() {
  const markConflict = useEditorStore((store) => store.markConflict);
  const setDescription = useEditorStore((store) => store.setDescription);
  const setName = useEditorStore((store) => store.setName);

  return (
    <button
      onClick={() => {
        setName("Local Flow");
        setDescription("Local description");
        markConflict(7);
      }}
      type="button"
    >
      Mark conflict
    </button>
  );
}

function StateProbe() {
  const name = useEditorStore((store) => store.name);
  const revision = useEditorStore((store) => store.serverRevision);
  const saveStatus = useEditorStore((store) => store.saveStatus);

  return (
    <div>
      <span data-testid="flow-name">{name}</span>
      <span data-testid="revision">{revision}</span>
      <span data-testid="save-status">{saveStatus}</span>
    </div>
  );
}

function createFlowResource(
  overrides: Partial<FlowResource> = {},
): FlowResource {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Test Flow",
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
