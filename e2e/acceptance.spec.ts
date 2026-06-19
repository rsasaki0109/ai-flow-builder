import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

type FlowNodeKind =
  | "core.input.text"
  | "core.text.template"
  | "ai.text.generate"
  | "core.output.text";

interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  specVersion: 1;
  position: {
    x: number;
    y: number;
  };
  label: string;
  config: unknown;
}

interface FlowEdge {
  id: string;
  source: {
    nodeId: string;
    portId: string;
  };
  target: {
    nodeId: string;
    portId: string;
  };
}

interface FlowGraph {
  schemaVersion: 1;
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

interface FlowResource {
  id: string;
  name: string;
  description: string | null;
  graph: FlowGraph;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

interface FlowResourceResponse {
  data: FlowResource;
}

test.describe("MVP acceptance flows", () => {
  test("manual create, edit, save, and reload", async ({ page }) => {
    const nodeLabel = `Manual Input ${randomSuffix()}`;

    await page.goto("/");
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/flows") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await page.getByRole("button", { name: "New Flow" }).first().click();
    const createdFlowResponse = await createResponse;
    const createdFlowBody =
      (await createdFlowResponse.json()) as FlowResourceResponse;
    await page.goto(`/flows/${createdFlowBody.data.id}`);
    await expect(page).toHaveURL(/\/flows\/[0-9a-f-]+$/);
    await expect(page.getByTestId("flow-canvas")).toBeVisible();

    const saveAfterAdd = waitForFlowUpdate(page);
    await page.getByRole("button", { name: "Add Text Input" }).click();
    await saveAfterAdd;
    await expect(page.getByText("1 nodes · 0 edges")).toBeVisible();
    await expect(page.getByTestId("flow-node-core.input.text")).toBeVisible();

    const saveAfterLabel = waitForFlowUpdate(page);
    const labelInput = page.getByLabel("Node label");
    await labelInput.fill(nodeLabel);
    await labelInput.blur();
    await saveAfterLabel;
    await expect(page.getByText("Saved")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    await expect(page.getByText("1 nodes · 0 edges")).toBeVisible();
    await expect(page.getByTestId("flow-node-core.input.text")).toContainText(
      nodeLabel,
    );
  });

  test("runs a deterministic text flow", async ({ page, request }) => {
    const flow = await createFlow(request, {
      graph: createTemplateFlowGraph("Processed: {{input}}"),
      name: `Run Flow ${randomSuffix()}`,
    });

    await page.goto(`/flows/${flow.id}`);
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    await expect(page.locator("header").getByText("0 errors")).toBeVisible();

    await page.getByRole("button", { name: "Run" }).first().click();
    const runPanel = page.locator(
      'section[aria-labelledby="run-panel-heading"]',
    );
    await runPanel.getByRole("textbox", { name: "Input" }).fill("Hello E2E");
    await runPanel.getByRole("button", { name: "Run" }).click();

    await expect(page.getByText("Outputs")).toBeVisible();
    await expect(
      runPanel.getByText("Processed: Hello E2E").first(),
    ).toBeVisible();
    await expect(page.getByText("Node results")).toBeVisible();
  });

  test("generates a flow with fake AI, applies it, and undoes it", async ({
    page,
    request,
  }) => {
    const flow = await createFlow(request, {
      name: `AI Flow ${randomSuffix()}`,
    });

    await page.goto(`/flows/${flow.id}`);
    await expect(page.getByText("0 nodes · 0 edges")).toBeVisible();

    await page.getByRole("button", { name: "Generate with AI" }).click();
    await page
      .getByLabel("Prompt")
      .fill("Create a simple text template flow and return the result.");
    await page.getByRole("button", { name: "Generate Flow" }).click();

    await expect(page.getByText("Generated flow preview")).toBeVisible();
    await expect(page.getByText("Fake Text Flow")).toBeVisible();
    await page.getByRole("button", { name: "Review Apply" }).click();
    await expect(page.getByText("Apply generated flow?")).toBeVisible();
    await page.getByRole("button", { name: "Apply Generated Flow" }).click();

    await expect(page.getByText("3 nodes · 2 edges")).toBeVisible();
    await expect(page.getByTestId("flow-node-core.input.text")).toBeVisible();
    await expect(
      page.getByTestId("flow-node-core.text.template"),
    ).toBeVisible();
    await expect(page.getByTestId("flow-node-core.output.text")).toBeVisible();

    await page.keyboard.press("ControlOrMeta+Z");
    await expect(page.getByText("0 nodes · 0 edges")).toBeVisible();
  });

  test("generates and downloads deterministic TypeScript", async ({
    page,
    request,
  }) => {
    const flow = await createFlow(request, {
      graph: createTemplateFlowGraph("Download: {{input}}"),
      name: `Codegen Flow ${randomSuffix()}`,
    });

    await page.goto(`/flows/${flow.id}`);
    await expect(page.locator("header").getByText("0 errors")).toBeVisible();
    await page.getByRole("button", { name: "Generate Code" }).click();
    await page
      .locator('section[aria-labelledby="code-panel-heading"]')
      .getByRole("button", { name: "Generate" })
      .click();

    const generatedCode = page.getByLabel("Generated code");
    await expect(generatedCode).toBeVisible();
    await expect(generatedCode).toContainText("export async function runFlow");
    await expect(generatedCode).toContainText("Download: ");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("flow.ts");

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const content = await readFile(downloadPath ?? "", "utf8");
    expect(content).toContain("export async function runFlow");
    expect(content).toContain("Download: ");
  });
});

async function createFlow(
  request: APIRequestContext,
  input: {
    readonly graph?: FlowGraph;
    readonly name: string;
  },
): Promise<FlowResource> {
  const response = await request.post("/api/flows", {
    data: {
      description: null,
      name: input.name,
      ...(input.graph === undefined ? {} : { graph: input.graph }),
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as FlowResourceResponse;
  return body.data;
}

function createTemplateFlowGraph(template: string): FlowGraph {
  const inputNodeId = randomUUID();
  const templateNodeId = randomUUID();
  const outputNodeId = randomUUID();

  return {
    schemaVersion: 1,
    nodes: [
      {
        id: inputNodeId,
        kind: "core.input.text",
        specVersion: 1,
        position: { x: 0, y: 0 },
        label: "Text Input",
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
      },
      {
        id: templateNodeId,
        kind: "core.text.template",
        specVersion: 1,
        position: { x: 300, y: 0 },
        label: "Text Template",
        config: {
          template,
        },
      },
      {
        id: outputNodeId,
        kind: "core.output.text",
        specVersion: 1,
        position: { x: 600, y: 0 },
        label: "Text Output",
        config: {
          key: "result",
          label: "Result",
        },
      },
    ],
    edges: [
      {
        id: randomUUID(),
        source: {
          nodeId: inputNodeId,
          portId: "value",
        },
        target: {
          nodeId: templateNodeId,
          portId: "input",
        },
      },
      {
        id: randomUUID(),
        source: {
          nodeId: templateNodeId,
          portId: "text",
        },
        target: {
          nodeId: outputNodeId,
          portId: "value",
        },
      },
    ],
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
  };
}

function waitForFlowUpdate(page: Page): Promise<unknown> {
  return page.waitForResponse(
    (response) =>
      /\/api\/flows\/[0-9a-f-]+$/.test(response.url()) &&
      response.request().method() === "PUT" &&
      response.status() === 200,
  );
}

function randomSuffix(): string {
  return randomUUID().slice(0, 8);
}
