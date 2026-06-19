import type { FlowRepository } from "@ai-flow-builder/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AppConfig } from "../../../server/config.js";
import {
  createServerContainer,
  setServerContainerForTest,
} from "../../../server/container.js";
import { GET } from "./route.js";

const REQUEST_ID = "20000000-0000-4000-8000-000000000001";

beforeEach(() => {
  const flowRepository = createFakeFlowRepository();
  setServerContainerForTest(
    createServerContainer({
      config: createConfig(),
      flowRepository,
    }),
  );
});

afterEach(() => {
  setServerContainerForTest(null);
});

describe("/api/health route", () => {
  it("returns configured health without calling the AI provider", async () => {
    const response = await GET(
      new Request("http://localhost/api/health", {
        headers: { "x-request-id": REQUEST_ID },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        status: "ok",
        version: "0.1.0",
        database: "ok",
        aiProvider: "fake",
      },
    });
  });
});

function createConfig(): AppConfig {
  return {
    nodeEnv: "test",
    databaseUrl: "file::memory:",
    aiProvider: "fake",
    aiRequestTimeoutMs: 45_000,
    flowRunTimeoutMs: 60_000,
    logLevel: "silent",
  };
}

function createFakeFlowRepository(): FlowRepository {
  return {
    list: async () => [],
    findById: async () => null,
    create: async () => {
      throw new Error("Not implemented in this test fake.");
    },
    update: async () => ({ status: "not_found" }),
    delete: async () => false,
  };
}
