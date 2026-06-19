import { describe, expect, it } from "vitest";
import { InvalidRequestError } from "../errors.js";
import { createAppLogger } from "../logger.js";
import { handleApiRoute } from "./handler.js";
import { successResponse } from "./response.js";

const REQUEST_ID = "20000000-0000-4000-8000-000000000001";
const FLOW_ID = "10000000-0000-4000-8000-000000000001";

describe("handleApiRoute", () => {
  it("returns the handler response and logs safe request metadata", async () => {
    const destination = new MemoryDestination();
    const logger = createAppLogger({ level: "info", destination });

    const response = await handleApiRoute(
      requestWithBody({
        prompt: "secret prompt text",
        inputs: {
          input: "secret flow input",
        },
      }),
      {
        route: "/api/flows/[flowId]/run",
        operation: "run_flow",
        logger,
      },
      ({ requestId, setLogFields }) => {
        setLogFields({ flowId: FLOW_ID });

        return successResponse({ ok: true }, { requestId });
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    expect(await response.json()).toEqual({ data: { ok: true } });

    const logRecord = parseLogRecord(destination.lastLine());
    expect(logRecord.requestId).toBe(REQUEST_ID);
    expect(logRecord.route).toBe("/api/flows/[flowId]/run");
    expect(logRecord.operation).toBe("run_flow");
    expect(logRecord.flowId).toBe(FLOW_ID);
    expect(logRecord.success).toBe(true);
    expect(logRecord.status).toBe(200);
    expect(typeof logRecord.durationMs).toBe("number");
    expect(destination.output()).not.toContain("secret prompt text");
    expect(destination.output()).not.toContain("secret flow input");
  });

  it("maps thrown application errors and logs the safe error code", async () => {
    const destination = new MemoryDestination();
    const logger = createAppLogger({ level: "info", destination });

    const response = await handleApiRoute(
      requestWithBody({
        openAiApiKey: "sk-secret-key",
      }),
      {
        route: "/api/ai/generate-flow",
        operation: "generate_flow_from_text",
        logger,
      },
      () => {
        throw new InvalidRequestError("The request body is invalid.");
      },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: {
        code: "INVALID_REQUEST",
        requestId: REQUEST_ID,
      },
    });

    const logRecord = parseLogRecord(destination.lastLine());
    expect(logRecord.success).toBe(false);
    expect(logRecord.status).toBe(400);
    expect(logRecord.errorCode).toBe("INVALID_REQUEST");
    expect(destination.output()).not.toContain("sk-secret-key");
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

function requestWithBody(body: unknown): Request {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-request-id": REQUEST_ID,
    },
    body: JSON.stringify(body),
  });
}

function parseLogRecord(line: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(line);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Log line was not a JSON object.");
  }

  return parsed as Record<string, unknown>;
}
