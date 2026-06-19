import { z } from "zod";

const nodeRunResultSchema = z.discriminatedUnion("status", [
  z
    .object({
      nodeId: z.string().min(1),
      status: z.literal("succeeded"),
      durationMs: z.number().nonnegative(),
      outputPreview: z.string(),
    })
    .strict(),
  z
    .object({
      nodeId: z.string().min(1),
      status: z.literal("failed"),
      durationMs: z.number().nonnegative(),
      errorMessage: z.string().min(1),
    })
    .strict(),
]);

const runResultSchema = z
  .object({
    status: z.literal("succeeded"),
    startedAt: z.string().min(1),
    completedAt: z.string().min(1),
    durationMs: z.number().nonnegative(),
    outputs: z.record(z.string().min(1), z.string()),
    nodeResults: z.array(nodeRunResultSchema),
  })
  .strict();

const runFlowSuccessResponseSchema = z
  .object({
    data: runResultSchema,
  })
  .strict();

const errorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        requestId: z.string().min(1),
        details: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();

export type RunResult = z.infer<typeof runResultSchema>;
export type NodeRunResult = z.infer<typeof nodeRunResultSchema>;

export interface RunFlowRequest {
  readonly flowId: string;
  readonly inputs: Record<string, string>;
  readonly signal?: AbortSignal;
}

export class RunFlowClientError extends Error {
  public override readonly name = "RunFlowClientError";

  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function runFlow(request: RunFlowRequest): Promise<RunResult> {
  const response = await fetch(
    `/api/flows/${encodeURIComponent(request.flowId)}/run`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ inputs: request.inputs }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    },
  );
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new RunFlowClientError(
        "INVALID_ERROR_RESPONSE",
        "The run request failed.",
        response.status,
      );
    }

    throw new RunFlowClientError(
      parsed.data.error.code,
      parsed.data.error.message,
      response.status,
      parsed.data.error.details,
    );
  }

  const parsed = runFlowSuccessResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new RunFlowClientError(
      "INVALID_RUN_RESPONSE",
      "The run response was invalid.",
      response.status,
    );
  }

  return parsed.data.data;
}
