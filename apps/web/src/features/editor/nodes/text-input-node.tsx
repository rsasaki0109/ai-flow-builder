"use client";

import type { NodeProps } from "@xyflow/react";
import type { ReactFlowNode } from "../adapters/index.js";
import { FlowNodeCard } from "./flow-node-card.js";

export function TextInputNode(props: NodeProps<ReactFlowNode>) {
  return <FlowNodeCard props={props} tone="input" />;
}
