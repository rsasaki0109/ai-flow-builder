export const validationIssueCodes = {
  invalidFlowSchema: "INVALID_FLOW_SCHEMA",
  invalidNodeConfig: "INVALID_NODE_CONFIG",
  unknownNodeSpec: "UNKNOWN_NODE_SPEC",
  duplicateNodeId: "DUPLICATE_NODE_ID",
  duplicateEdgeId: "DUPLICATE_EDGE_ID",
  edgeSourceNodeNotFound: "EDGE_SOURCE_NODE_NOT_FOUND",
  edgeTargetNodeNotFound: "EDGE_TARGET_NODE_NOT_FOUND",
  edgeSourcePortNotFound: "EDGE_SOURCE_PORT_NOT_FOUND",
  edgeTargetPortNotFound: "EDGE_TARGET_PORT_NOT_FOUND",
  edgeSourcePortDirectionInvalid: "EDGE_SOURCE_PORT_DIRECTION_INVALID",
  edgeTargetPortDirectionInvalid: "EDGE_TARGET_PORT_DIRECTION_INVALID",
  edgePortTypeMismatch: "EDGE_PORT_TYPE_MISMATCH",
  duplicateTargetInput: "DUPLICATE_TARGET_INPUT",
  selfLoopEdge: "SELF_LOOP_EDGE",
  graphHasCycle: "GRAPH_HAS_CYCLE",
  requiredInputNotConnected: "REQUIRED_INPUT_NOT_CONNECTED",
  duplicateTextInputKey: "DUPLICATE_TEXT_INPUT_KEY",
  duplicateTextOutputKey: "DUPLICATE_TEXT_OUTPUT_KEY",
  outputNodeRequired: "OUTPUT_NODE_REQUIRED",
  unknownTemplatePlaceholder: "UNKNOWN_TEMPLATE_PLACEHOLDER",
  nodeNotReachingOutput: "NODE_NOT_REACHING_OUTPUT",
  unusedInputNode: "UNUSED_INPUT_NODE",
} as const;

export type ValidationIssueCode =
  (typeof validationIssueCodes)[keyof typeof validationIssueCodes];

export interface ValidationIssue {
  readonly severity: "error" | "warning";
  readonly code: ValidationIssueCode | string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
  readonly path?: string;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

export const validationResult = (
  issues: readonly ValidationIssue[],
): ValidationResult => ({
  valid: !issues.some((issue) => issue.severity === "error"),
  issues,
});

export const pathToString = (path: readonly PropertyKey[]): string =>
  path.map(String).join(".");
