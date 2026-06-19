import {
  errorResponseSchema,
  generatedCodeBundleSchema,
  successResponseSchema,
  type GeneratedCodeBundle,
} from "@ai-flow-builder/flow-core";

const generateCodeSuccessResponseSchema = successResponseSchema(
  generatedCodeBundleSchema,
);

export interface GenerateCodeRequest {
  readonly flowId: string;
  readonly language?: "typescript";
  readonly signal?: AbortSignal;
}

export class GenerateCodeClientError extends Error {
  public override readonly name = "GenerateCodeClientError";

  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export async function generateCode(
  request: GenerateCodeRequest,
): Promise<GeneratedCodeBundle> {
  const response = await fetch(
    `/api/flows/${encodeURIComponent(request.flowId)}/code`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ language: request.language ?? "typescript" }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    },
  );
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const parsed = errorResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new GenerateCodeClientError(
        "INVALID_ERROR_RESPONSE",
        "Code generation failed.",
        response.status,
      );
    }

    throw new GenerateCodeClientError(
      parsed.data.error.code,
      parsed.data.error.message,
      response.status,
      parsed.data.error.details,
    );
  }

  const parsed = generateCodeSuccessResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new GenerateCodeClientError(
      "INVALID_GENERATE_CODE_RESPONSE",
      "The generated code response was invalid.",
      response.status,
    );
  }

  return parsed.data.data;
}
