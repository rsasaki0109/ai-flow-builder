import { z } from "zod";

export const successResponseSchema = <TData extends z.ZodType>(data: TData) =>
  z
    .object({
      data,
    })
    .strict();

export const errorResponseSchema = z
  .object({
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        requestId: z.uuid(),
        details: z.unknown().optional(),
      })
      .strict(),
  })
  .strict();

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const generateCodeRequestSchema = z
  .object({
    language: z.string().min(1),
  })
  .strict();

export const generatedCodeFileSchema = z
  .object({
    path: z.string().min(1),
    content: z.string(),
  })
  .strict();

export const codegenWarningSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    nodeId: z.string().optional(),
    path: z.string().optional(),
  })
  .strict();

export const generatedCodeBundleSchema = z
  .object({
    language: z.literal("typescript"),
    entrypoint: z.string().min(1),
    files: z.array(generatedCodeFileSchema),
    warnings: z.array(codegenWarningSchema),
  })
  .strict();

export type GenerateCodeRequest = z.infer<typeof generateCodeRequestSchema>;
export type GeneratedCodeBundle = z.infer<typeof generatedCodeBundleSchema>;
