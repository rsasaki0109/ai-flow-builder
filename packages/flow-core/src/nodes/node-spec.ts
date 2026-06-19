import type { z } from "zod";
import type { FlowNodeKind } from "../schemas/flow-graph.js";

export type PortDataType = "text" | "number" | "boolean" | "json" | "any";

export interface PortSpec {
  readonly id: string;
  readonly label: string;
  readonly direction: "input" | "output";
  readonly dataType: PortDataType;
  readonly required: boolean;
}

export interface NodeSpec<TConfig> {
  readonly kind: FlowNodeKind;
  readonly version: number;
  readonly displayName: string;
  readonly description: string;
  readonly category: "input" | "transform" | "ai" | "output";
  readonly configSchema: z.ZodType<TConfig>;
  readonly inputs: readonly PortSpec[];
  readonly outputs: readonly PortSpec[];
  readonly defaultConfig: TConfig;
  readonly defaultLabel: string;
}
