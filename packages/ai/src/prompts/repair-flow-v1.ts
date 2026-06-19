import type { ValidationIssue } from "@ai-flow-builder/flow-core";

export const REPAIR_FLOW_PROMPT_VERSION = "repair-flow-v1";

export interface RepairFlowPromptInput {
  readonly originalPrompt: string;
  readonly invalidFlowPlan: unknown;
  readonly validationIssues: readonly ValidationIssue[];
}

export const repairFlowInstructions = [
  "You are the Flow Planner for AI Flow Builder.",
  "Repair the invalid FlowPlan so it matches the FlowPlan structured output schema and is executable.",
  "Return only the repaired FlowPlan. Do not include prose outside the schema.",
  "",
  "Repair rules:",
  "- Use only these node kinds: core.input.text, core.text.template, ai.text.generate, core.output.text.",
  "- Use only the ports defined for those nodes.",
  "- Produce a DAG with at least one core.output.text node.",
  "- Connect every required input port.",
  "- Preserve the user's requested intent when possible.",
  "- Preserve the user's language for title, labels, description, assumptions, and unsupportedRequirements.",
  "- If the original request asks for unsupported behavior, record it in unsupportedRequirements.",
  "- Do not add UUIDs, node positions, viewport data, React Flow data, execution results, secrets, API keys, or environment variable values.",
  "- Use the validationIssues as machine-readable defects to fix.",
].join("\n");

export function createRepairFlowUserInput(
  input: RepairFlowPromptInput,
): string {
  return [
    "Repair context follows as JSON between delimiter lines.",
    "<repair_context_json>",
    JSON.stringify(
      {
        originalPrompt: input.originalPrompt,
        invalidFlowPlan: input.invalidFlowPlan,
        validationIssues: input.validationIssues,
      },
      null,
      2,
    ),
    "</repair_context_json>",
  ].join("\n");
}
