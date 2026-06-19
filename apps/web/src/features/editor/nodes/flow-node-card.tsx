"use client";

import {
  getNodeSpec,
  type FlowNodeKind,
  type PortSpec,
} from "@ai-flow-builder/flow-core";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { ReactFlowNode } from "../adapters/index.js";

interface FlowNodeCardProps {
  props: NodeProps<ReactFlowNode>;
  tone: "ai" | "input" | "output" | "transform";
}

const toneClasses: Record<FlowNodeCardProps["tone"], string> = {
  ai: "border-[#8b5cf6] bg-[#f5f3ff] text-[#4c1d95]",
  input: "border-[#0f766e] bg-[#ecfdf5] text-[#134e4a]",
  output: "border-[#e11d48] bg-[#fff1f2] text-[#881337]",
  transform: "border-[#d97706] bg-[#fffbeb] text-[#78350f]",
};

export function FlowNodeCard({ props, tone }: FlowNodeCardProps) {
  const flowNode = props.data.flowNode;
  const spec = getNodeSpec(flowNode.kind, flowNode.specVersion);

  return (
    <article
      className={[
        "relative w-[220px] rounded-md border-2 bg-white shadow-sm",
        props.selected ? "ring-2 ring-[var(--accent)] ring-offset-2" : "",
      ].join(" ")}
      data-kind={flowNode.kind}
      data-testid={`flow-node-${flowNode.kind}`}
    >
      <div className="flex items-start gap-3 border-b border-[var(--border)] px-3 py-3">
        <span
          aria-hidden="true"
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
            toneClasses[tone],
          ].join(" ")}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">
            {flowNode.label}
          </h3>
          <p className="mt-1 truncate text-xs text-[var(--muted)]">
            {spec.displayName}
          </p>
        </div>
      </div>

      <div className="px-3 py-3">
        <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">
          {spec.description}
        </p>
      </div>

      <PortHandles kind={flowNode.kind} ports={spec.inputs} type="target" />
      <PortHandles kind={flowNode.kind} ports={spec.outputs} type="source" />
    </article>
  );
}

interface PortHandlesProps {
  kind: FlowNodeKind;
  ports: readonly PortSpec[];
  type: "source" | "target";
}

function PortHandles({ kind, ports, type }: PortHandlesProps) {
  return (
    <>
      {ports.map((port, index) => (
        <Handle
          aria-label={`${kind} ${type} ${port.id}`}
          className="!h-3 !w-3 !border-2 !border-white !bg-[var(--foreground)]"
          id={port.id}
          isConnectable
          key={port.id}
          position={type === "target" ? Position.Left : Position.Right}
          style={{
            top: `${getPortTop(index, ports.length)}%`,
          }}
          title={port.label}
          type={type}
        />
      ))}
    </>
  );
}

function getPortTop(index: number, total: number): number {
  if (total <= 1) {
    return 50;
  }

  return 25 + (index * 50) / (total - 1);
}
