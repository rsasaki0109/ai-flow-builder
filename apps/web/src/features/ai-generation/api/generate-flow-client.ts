import {
  errorResponseSchema,
  flowGraphSchema,
  successResponseSchema,
} from "@ai-flow-builder/flow-core";
import { z } from "zod";

const validationIssueSchema = z
  .object({
    severity: z.enum(["error", "warning"]),
    code: z.string().min(1),
    message: z.string().min(1),
    nodeId: z.string().optional(),
    edgeId: z.string().optional(),
    path: z.string().optional(),
  })
  .strict();

const generatedFlowDraftSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    graph: flowGraphSchema,
  })
  .strict();

const generateFlowResultSchema = z
  .object({
    draft: generatedFlowDraftSchema,
    assumptions: z.array(z.string()),
    unsupportedRequirements: z.array(z.string()),
    warnings: z.array(validationIssueSchema),
    meta: z
      .object({
        provider: z.string().min(1),
        model: z.string().nullable(),
        promptVersion: z.string().min(1),
        repairPromptVersion: z.string().min(1).optional(),
        attempts: z.union([z.literal(1), z.literal(2)]),
      })
      .strict(),
  })
  .strict();

const generateFlowSuccessResponseSchema = successResponseSchema(
  generateFlowResultSchema,
);

export type GeneratedFlowDraft = z.infer<typeof generatedFlowDraftSchema>;
export type GenerateFlowResult = z.infer<typeof generateFlowResultSchema>;

export interface GenerateFlowRequest {
  readonly prompt: string;
  readonly signal?: AbortSignal;
}

export class GenerateFlowClientError extends Error {
  public override readonly name = "GenerateFlowClientError";

  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function generateFlowFromText(
  request: GenerateFlowRequest,
): Promise<GenerateFlowResult> {
  const response = await fetch("/api/ai/generate-flow", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ prompt: request.prompt }),
    ...(request.signal === undefined ? {} : { signal: request.signal }),
  });
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new GenerateFlowClientError(
        "INVALID_ERROR_RESPONSE",
        "AI flow generation failed.",
        response.status,
      );
    }

    throw new GenerateFlowClientError(
      parsed.data.error.code,
      parsed.data.error.message,
      response.status,
      parsed.data.error.details,
    );
  }

  const parsed = generateFlowSuccessResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new GenerateFlowClientError(
      "INVALID_GENERATE_FLOW_RESPONSE",
      "The generated flow response was invalid.",
      response.status,
    );
  }

  return parsed.data.data;
}
