import type { FlowNode, FlowNodeKind } from "@ai-flow-builder/flow-core";
import { describe, expect, it } from "vitest";
import {
  createStableNodeVariableNames,
  createUniqueNameAllocator,
  toSafeIdentifier,
} from "../index.js";

describe("TypeScript naming helpers", () => {
  it("converts labels to lower camel case safe identifiers", () => {
    expect(toSafeIdentifier("Text Input")).toBe("textInput");
    expect(toSafeIdentifier("AI Generate")).toBe("aiGenerate");
    expect(toSafeIdentifier("customer-email")).toBe("customerEmail");
    expect(toSafeIdentifier("Résumé output")).toBe("resumeOutput");
  });

  it("uses the fallback for Japanese-only and symbol-only labels", () => {
    expect(toSafeIdentifier("要約結果", "node")).toBe("node");
    expect(toSafeIdentifier("結果 123", "node")).toBe("node123");
    expect(toSafeIdentifier("!!!", "node")).toBe("node");
  });

  it("guards against leading digits and reserved words", () => {
    expect(toSafeIdentifier("123 result", "node")).toBe("node123Result");
    expect(toSafeIdentifier("class")).toBe("classValue");
    expect(toSafeIdentifier("await")).toBe("awaitValue");
  });

  it("allocates duplicate names with stable numeric suffixes", () => {
    const allocator = createUniqueNameAllocator(["inputs"]);

    expect(allocator.allocate("inputs")).toBe("inputs2");
    expect(allocator.allocate("Text Input")).toBe("textInput");
    expect(allocator.allocate("Text Input")).toBe("textInput2");
    expect(allocator.allocate("text-input")).toBe("textInput3");
  });

  it("creates stable node variable names sorted by node ID", () => {
    const laterNode = createNode({
      id: "22222222-2222-4222-8222-222222222222",
      label: "Text Input",
    });
    const earlierNode = createNode({
      id: "11111111-1111-4111-8111-111111111111",
      label: "Text Input",
    });

    const names = createStableNodeVariableNames([laterNode, earlierNode]);

    expect(names.get(earlierNode.id)).toBe("textInput");
    expect(names.get(laterNode.id)).toBe("textInput2");
  });

  it("uses node kind fallbacks when labels do not contain ASCII words", () => {
    const names = createStableNodeVariableNames([
      createNode({
        id: "11111111-1111-4111-8111-111111111111",
        kind: "core.input.text",
        label: "入力",
      }),
      createNode({
        id: "22222222-2222-4222-8222-222222222222",
        kind: "core.text.template",
        label: "変換",
      }),
      createNode({
        id: "33333333-3333-4333-8333-333333333333",
        kind: "ai.text.generate",
        label: "生成",
      }),
      createNode({
        id: "44444444-4444-4444-8444-444444444444",
        kind: "core.output.text",
        label: "出力",
      }),
    ]);

    expect([...names.values()]).toEqual([
      "textInput",
      "textTemplate",
      "aiGenerate",
      "textOutput",
    ]);
  });

  it("keeps reserved node labels safe before duplicate suffixing", () => {
    const firstNode = createNode({
      id: "11111111-1111-4111-8111-111111111111",
      label: "class",
    });
    const secondNode = createNode({
      id: "22222222-2222-4222-8222-222222222222",
      label: "class",
    });

    const names = createStableNodeVariableNames([secondNode, firstNode]);

    expect(names.get(firstNode.id)).toBe("classValue");
    expect(names.get(secondNode.id)).toBe("classValue2");
  });
});

function createNode(input: {
  readonly id: string;
  readonly kind?: FlowNodeKind;
  readonly label: string;
}): FlowNode {
  return {
    config: {},
    id: input.id,
    kind: input.kind ?? "core.input.text",
    label: input.label,
    position: { x: 0, y: 0 },
    specVersion: 1,
  };
}
