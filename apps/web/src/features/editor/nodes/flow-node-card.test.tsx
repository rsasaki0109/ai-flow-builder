// @vitest-environment jsdom

import type { FlowNode, FlowNodeKind } from "@ai-flow-builder/flow-core";
import type { NodeProps } from "@xyflow/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactFlowNode } from "../adapters/index.js";
import { AiGenerateNode } from "./ai-generate-node.js";
import { flowNodeTypes } from "./node-types.js";
import { TextInputNode } from "./text-input-node.js";
import { TextOutputNode } from "./text-output-node.js";
import { TextTemplateNode } from "./text-template-node.js";

interface MockHandleProps {
  "aria-label"?: string;
  id?: string;
  position: string;
  title?: string;
  type: "source" | "target";
}

vi.mock("@xyflow/react", () => ({
  Handle: ({
    "aria-label": ariaLabel,
    id,
    position,
    title,
    type,
  }: MockHandleProps) => (
    <div
      aria-label={ariaLabel}
      data-handle-id={id}
      data-position={position}
      data-testid={`handle-${type}-${id}`}
      title={title}
    />
  ),
  Position: {
    Left: "left",
    Right: "right",
  },
}));

afterEach(() => {
  cleanup();
});

describe("custom flow nodes", () => {
  it("registers one custom node component for each built-in kind", () => {
    expect(Object.keys(flowNodeTypes).sort()).toEqual([
      "ai.text.generate",
      "core.input.text",
      "core.output.text",
      "core.text.template",
    ]);
  });

  it("renders input node output handles from the Node Spec", () => {
    render(<TextInputNode {...createNodeProps("core.input.text")} />);

    expect(screen.getByRole("heading", { name: "Text Input" })).toBeTruthy();
    expect(screen.getByText("Receives a text value at run time.")).toBeTruthy();
    expect(screen.getByLabelText("core.input.text source value")).toBeTruthy();
    expect(screen.queryByLabelText(/core\.input\.text target/u)).toBeNull();
  });

  it("renders transform node input and output handles from the Node Spec", () => {
    render(<TextTemplateNode {...createNodeProps("core.text.template")} />);

    expect(
      screen.getByLabelText("core.text.template target input"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("core.text.template source text"),
    ).toBeTruthy();
  });

  it("renders AI node prompt and text handles from the Node Spec", () => {
    render(<AiGenerateNode {...createNodeProps("ai.text.generate")} />);

    expect(
      screen.getByLabelText("ai.text.generate target prompt"),
    ).toBeTruthy();
    expect(screen.getByLabelText("ai.text.generate source text")).toBeTruthy();
  });

  it("renders output node input handles from the Node Spec", () => {
    render(<TextOutputNode {...createNodeProps("core.output.text")} />);

    expect(screen.getByLabelText("core.output.text target value")).toBeTruthy();
    expect(screen.queryByLabelText(/core\.output\.text source/u)).toBeNull();
  });
});

function createNodeProps(kind: FlowNodeKind): NodeProps<ReactFlowNode> {
  const flowNode = createFlowNode(kind);

  return {
    data: {
      flowNode,
      kind,
      label: flowNode.label,
    },
    deletable: true,
    draggable: false,
    dragging: false,
    id: flowNode.id,
    isConnectable: true,
    positionAbsoluteX: flowNode.position.x,
    positionAbsoluteY: flowNode.position.y,
    selectable: true,
    selected: false,
    type: kind,
    zIndex: 0,
  };
}

function createFlowNode(kind: FlowNodeKind): FlowNode {
  const base = {
    id: "10000000-0000-4000-8000-000000000101",
    kind,
    position: { x: 0, y: 0 },
    specVersion: 1,
  } as const;

  switch (kind) {
    case "ai.text.generate":
      return {
        ...base,
        config: {},
        label: "AI Generate",
      };
    case "core.input.text":
      return {
        ...base,
        config: {
          key: "input",
          label: "Input",
          required: true,
        },
        label: "Text Input",
      };
    case "core.output.text":
      return {
        ...base,
        config: {
          key: "result",
          label: "Result",
        },
        label: "Text Output",
      };
    case "core.text.template":
      return {
        ...base,
        config: {
          template: "{{input}}",
        },
        label: "Text Template",
      };
  }
}
