import { z } from "zod";
import { InvalidRequestError } from "../errors.js";

export async function parseJsonRequest<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (cause) {
    throw new InvalidRequestError("The request body must be valid JSON.", {
      cause: String(cause),
    });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new InvalidRequestError("The request body is invalid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export function parseSearchParams<TSchema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: TSchema,
): z.infer<TSchema> {
  const rawParams: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    rawParams[key] = value;
  }

  const parsed = schema.safeParse(rawParams);
  if (!parsed.success) {
    throw new InvalidRequestError("The query parameters are invalid.", {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    });
  }

  return parsed.data;
}

export function parseUuidPathParam(name: string, value: string): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new InvalidRequestError(`Path parameter "${name}" must be a UUID.`, {
      [name]: value,
    });
  }

  return parsed.data;
}
