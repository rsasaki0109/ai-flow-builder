import { describe, expect, it } from "vitest";
import { createAppLogger, logHttpRequest } from "./logger.js";

const REQUEST_ID = "20000000-0000-4000-8000-000000000001";

describe("app logger", () => {
  it("writes structured HTTP request fields", () => {
    const destination = new MemoryDestination();
    const logger = createAppLogger({ level: "info", destination });

    logHttpRequest(logger, {
      requestId: REQUEST_ID,
      route: "/api/flows/[flowId]/code",
      operation: "generate_code",
      flowId: "10000000-0000-4000-8000-000000000001",
      durationMs: 12.4,
      success: true,
      status: 200,
    });

    const line = destination.lastLine();
    const logRecord = parseLogRecord(line);
    expect(logRecord.requestId).toBe(REQUEST_ID);
    expect(logRecord.route).toBe("/api/flows/[flowId]/code");
    expect(logRecord.operation).toBe("generate_code");
    expect(logRecord.flowId).toBe("10000000-0000-4000-8000-000000000001");
    expect(logRecord.durationMs).toBe(12);
    expect(logRecord.success).toBe(true);
    expect(logRecord.status).toBe(200);
    expect(logRecord.prompt).toBeUndefined();
    expect(logRecord.inputs).toBeUndefined();
    expect(logRecord.outputs).toBeUndefined();
  });

  it("redacts prompt and API key fields if unsafe fields are logged", () => {
    const destination = new MemoryDestination();
    const logger = createAppLogger({ level: "info", destination });

    logger.info(
      {
        requestId: REQUEST_ID,
        prompt: "secret prompt text",
        openAiApiKey: "sk-secret-key",
        headers: {
          authorization: "Bearer secret-token",
        },
        body: {
          inputs: {
            input: "secret flow input",
          },
        },
      },
      "unsafe log attempt",
    );

    const output = destination.output();
    expect(output).not.toContain("secret prompt text");
    expect(output).not.toContain("sk-secret-key");
    expect(output).not.toContain("Bearer secret-token");
    expect(output).not.toContain("secret flow input");
  });
});

class MemoryDestination {
  private readonly lines: string[] = [];

  public write(line: string): void {
    this.lines.push(line);
  }

  public lastLine(): string {
    const line = this.lines.at(-1);
    if (line === undefined) {
      throw new Error("No log line was written.");
    }

    return line;
  }

  public output(): string {
    return this.lines.join("");
  }
}

function parseLogRecord(line: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(line);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Log line was not a JSON object.");
  }

  return parsed as Record<string, unknown>;
}
