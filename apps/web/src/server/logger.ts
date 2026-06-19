import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from "pino";

export type AppLogger = Logger;

export interface CreateAppLoggerOptions {
  readonly level: string;
  readonly destination?: DestinationStream;
}

export interface HttpRequestLogFields {
  readonly requestId: string;
  readonly route: string;
  readonly operation: string;
  readonly durationMs: number;
  readonly success: boolean;
  readonly status?: number;
  readonly flowId?: string;
  readonly provider?: string;
  readonly model?: string | null;
  readonly errorCode?: string;
}

const redactedPaths = [
  "authorization",
  "headers.authorization",
  "headers.Authorization",
  "apiKey",
  "api_key",
  "openAiApiKey",
  "OPENAI_API_KEY",
  "databaseUrl",
  "DATABASE_URL",
  "prompt",
  "userPrompt",
  "input",
  "inputs",
  "output",
  "outputs",
  "response",
  "aiResponse",
  "body",
  "*.authorization",
  "*.apiKey",
  "*.openAiApiKey",
  "*.prompt",
  "*.inputs",
  "*.outputs",
  "*.body",
];

export function createAppLogger(options: CreateAppLoggerOptions): AppLogger {
  const loggerOptions: LoggerOptions = {
    level: options.level,
    base: null,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: redactedPaths,
      censor: "[Redacted]",
    },
  };

  if (options.destination === undefined) {
    return pino(loggerOptions);
  }

  return pino(loggerOptions, options.destination);
}

export function logHttpRequest(
  logger: AppLogger,
  fields: HttpRequestLogFields,
): void {
  const safeFields = safeHttpRequestLogFields(fields);
  const message = fields.success
    ? "HTTP request completed."
    : "HTTP request failed.";

  if (fields.success) {
    logger.info(safeFields, message);
  } else {
    logger.error(safeFields, message);
  }
}

function safeHttpRequestLogFields(fields: HttpRequestLogFields) {
  return {
    requestId: fields.requestId,
    route: fields.route,
    operation: fields.operation,
    durationMs: Math.max(0, Math.round(fields.durationMs)),
    success: fields.success,
    ...(fields.status === undefined ? {} : { status: fields.status }),
    ...(fields.flowId === undefined ? {} : { flowId: fields.flowId }),
    ...(fields.provider === undefined ? {} : { provider: fields.provider }),
    ...(fields.model === undefined ? {} : { model: fields.model }),
    ...(fields.errorCode === undefined ? {} : { errorCode: fields.errorCode }),
  };
}
