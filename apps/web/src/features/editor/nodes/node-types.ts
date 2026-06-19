import type { NodeTypes } from "@xyflow/react";
import { AiGenerateNode } from "./ai-generate-node.js";
import { TextInputNode } from "./text-input-node.js";
import { TextOutputNode } from "./text-output-node.js";
import { TextTemplateNode } from "./text-template-node.js";

export const flowNodeTypes = {
  "ai.text.generate": AiGenerateNode,
  "core.input.text": TextInputNode,
  "core.output.text": TextOutputNode,
  "core.text.template": TextTemplateNode,
} satisfies NodeTypes;
