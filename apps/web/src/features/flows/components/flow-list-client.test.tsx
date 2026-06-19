// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowListClient, type FlowListItem } from "./flow-list-client.js";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

const FLOW_ID = "10000000-0000-4000-8000-000000000001";

beforeEach(() => {
  routerPush.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("FlowListClient", () => {
  it("renders the empty state and disabled AI action", () => {
    render(<FlowListClient aiEnabled={false} initialItems={[]} />);

    expect(screen.getByRole("heading", { name: "No flows yet" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Generate with AI" }),
    ).toHaveProperty("disabled", true);
    expect(screen.getByText(/AI generation is disabled/u)).toBeTruthy();
  });

  it("creates a flow and navigates to the editor", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: FLOW_ID } }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<FlowListClient aiEnabled initialItems={[]} />);

    const [newFlowButton] = screen.getAllByRole("button", {
      name: "New Flow",
    });
    if (newFlowButton === undefined) {
      throw new Error("Expected a New Flow button.");
    }

    await user.click(newFlowButton);

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith(`/flows/${FLOW_ID}`);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/flows",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Untitled Flow",
          description: null,
        }),
      }),
    );
  });

  it("opens existing flows with links and deletes them through the API", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    const user = userEvent.setup();

    render(
      <FlowListClient
        aiEnabled
        initialItems={[
          createFlowListItem({
            id: FLOW_ID,
            name: "Existing Flow",
          }),
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open" }).getAttribute("href"),
    ).toBe(`/flows/${FLOW_ID}`);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Existing Flow")).toBeNull();
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/flows/${FLOW_ID}`, {
      method: "DELETE",
    });
  });
});

function createFlowListItem(
  overrides: Partial<FlowListItem> = {},
): FlowListItem {
  return {
    id: overrides.id ?? FLOW_ID,
    name: overrides.name ?? "Flow",
    description: overrides.description ?? null,
    revision: overrides.revision ?? 1,
    createdAt: overrides.createdAt ?? "2026-06-18T00:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-18T00:00:00.000Z",
  };
}
