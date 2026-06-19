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
