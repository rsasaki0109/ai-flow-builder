import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

export interface AppConfig {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  aiProvider: "disabled" | "openai" | "fake";
  openAiApiKey?: string;
  openAiModel?: string;
  aiRequestTimeoutMs: number;
  flowRunTimeoutMs: number;
  logLevel: string;
}

export type EnvInput = Record<string, string | undefined>;

export class AppConfigError extends Error {
  public readonly issues: readonly string[];

  public constructor(issues: readonly string[]) {
    super("Invalid application configuration.");
    this.name = "AppConfigError";
    this.issues = issues;
  }
}

const optionalNonEmptyStringSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

function integerEnvSchema(defaultValue: number) {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().int().positive().default(defaultValue),
  );
}

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_ROOT: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).default("."),
    ),
    DATABASE_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).default("file:./data/ai-flow-builder.db"),
    ),
    AI_PROVIDER: z.enum(["disabled", "openai", "fake"]).default("disabled"),
    OPENAI_API_KEY: optionalNonEmptyStringSchema,
    OPENAI_MODEL: optionalNonEmptyStringSchema,
    AI_REQUEST_TIMEOUT_MS: integerEnvSchema(45_000),
    FLOW_RUN_TIMEOUT_MS: integerEnvSchema(60_000),
    LOG_LEVEL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).default("info"),
    ),
  })
  .passthrough()
  .superRefine((env, context) => {
    if (env.DATABASE_URL === "file:") {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL must include a file path when using file: URLs.",
      });
    }

    if (env.AI_PROVIDER === "openai") {
      if (env.OPENAI_API_KEY === undefined) {
        context.addIssue({
          code: "custom",
          path: ["OPENAI_API_KEY"],
          message: "OPENAI_API_KEY is required when AI_PROVIDER=openai.",
        });
      }

      if (env.OPENAI_MODEL === undefined) {
        context.addIssue({
          code: "custom",
          path: ["OPENAI_MODEL"],
          message: "OPENAI_MODEL is required when AI_PROVIDER=openai.",
        });
      }

      if (env.NODE_ENV === "test") {
        context.addIssue({
          code: "custom",
          path: ["AI_PROVIDER"],
          message: "AI_PROVIDER=openai is not allowed in test.",
        });
      }
    }
  });

let cachedConfig: AppConfig | null = null;

export function getAppConfig(): AppConfig {
  cachedConfig ??= parseAppConfig(process.env);
  return cachedConfig;
}

export function resetAppConfigForTest(): void {
  cachedConfig = null;
}

export function parseAppConfig(env: EnvInput): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new AppConfigError(
      parsed.error.issues.map((issue) => {
        const path = issue.path.length === 0 ? "env" : issue.path.join(".");
        return `${path}: ${issue.message}`;
      }),
    );
  }

  const config = parsed.data;
  return {
    nodeEnv: config.NODE_ENV,
    databaseUrl: normalizeDatabaseUrl(config.DATABASE_URL, config.APP_ROOT),
    aiProvider: config.AI_PROVIDER,
    ...(config.OPENAI_API_KEY === undefined
      ? {}
      : { openAiApiKey: config.OPENAI_API_KEY }),
    ...(config.OPENAI_MODEL === undefined
      ? {}
      : { openAiModel: config.OPENAI_MODEL }),
    aiRequestTimeoutMs: config.AI_REQUEST_TIMEOUT_MS,
    flowRunTimeoutMs: config.FLOW_RUN_TIMEOUT_MS,
    logLevel: config.LOG_LEVEL,
  };
}

export function normalizeDatabaseUrl(
  databaseUrl: string,
  appRoot: string,
): string {
  if (!databaseUrl.startsWith("file:")) {
    return databaseUrl;
  }

  const rawFilePath = databaseUrl.slice("file:".length);
  if (rawFilePath === ":memory:" || rawFilePath.startsWith("//")) {
    return databaseUrl;
  }

  const absoluteAppRoot = resolve(appRoot);
  const absoluteFilePath = isAbsolute(rawFilePath)
    ? rawFilePath
    : resolve(absoluteAppRoot, rawFilePath);

  return `file:${absoluteFilePath}`;
}
