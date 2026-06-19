import { describe, expect, it } from "vitest";
import {
  AppConfigError,
  normalizeDatabaseUrl,
  parseAppConfig,
} from "./config.js";

describe("parseAppConfig", () => {
  it("accepts disabled AI configuration and normalizes relative file database URLs", () => {
    const config = parseAppConfig({
      NODE_ENV: "development",
      APP_ROOT: "/workspace/app",
      DATABASE_URL: "file:./data/ai-flow-builder.db",
      AI_PROVIDER: "disabled",
      LOG_LEVEL: "debug",
    });

    expect(config).toEqual({
      nodeEnv: "development",
      databaseUrl: "file:/workspace/app/data/ai-flow-builder.db",
      aiProvider: "disabled",
      aiRequestTimeoutMs: 45_000,
      flowRunTimeoutMs: 60_000,
      logLevel: "debug",
    });
  });

  it("rejects openai provider configuration without key and model", () => {
    expect(() =>
      parseAppConfig({
        NODE_ENV: "development",
        APP_ROOT: "/workspace/app",
        DATABASE_URL: "file:./data/test.db",
        AI_PROVIDER: "openai",
      }),
    ).toThrow(AppConfigError);
  });

  it("accepts fake provider in test configuration", () => {
    const config = parseAppConfig({
      NODE_ENV: "test",
      APP_ROOT: "/workspace/app",
      DATABASE_URL: "file:./data/test.db",
      AI_PROVIDER: "fake",
      AI_REQUEST_TIMEOUT_MS: "1000",
      FLOW_RUN_TIMEOUT_MS: "2000",
    });

    expect(config).toMatchObject({
      nodeEnv: "test",
      databaseUrl: "file:/workspace/app/data/test.db",
      aiProvider: "fake",
      aiRequestTimeoutMs: 1_000,
      flowRunTimeoutMs: 2_000,
      logLevel: "info",
    });
  });

  it("rejects openai provider in test configuration even when credentials are present", () => {
    try {
      parseAppConfig({
        NODE_ENV: "test",
        APP_ROOT: "/workspace/app",
        DATABASE_URL: "file:./data/test.db",
        AI_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "test-model",
      });
      throw new Error("Expected parseAppConfig to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(AppConfigError);
      expect((error as AppConfigError).issues).toContain(
        "AI_PROVIDER: AI_PROVIDER=openai is not allowed in test.",
      );
    }
  });

  it("preserves non-file database URLs", () => {
    expect(
      normalizeDatabaseUrl("libsql://example.turso.io", "/workspace/app"),
    ).toBe("libsql://example.turso.io");
  });
});
