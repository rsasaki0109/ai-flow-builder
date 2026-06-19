import type { FlowRepository } from "@ai-flow-builder/db";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppConfig } from "./config.js";
import {
  createServerContainer,
  getServerContainer,
  resetServerContainerForTest,
  setServerContainerForTest,
  type ServerContainer,
} from "./container.js";
import { FlowService } from "./services/flow-service.js";

const tempDirs: string[] = [];

afterEach(async () => {
  resetServerContainerForTest();
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

describe("server container", () => {
  it("uses an injected repository without creating infrastructure dependencies", () => {
    const config = createConfig({
      databaseUrl: "file:/path/that/need/not/exist.db",
    });
    const flowRepository = createFakeFlowRepository();

    const container = createServerContainer({ config, flowRepository });

    expect(container.config).toBe(config);
    expect(container.flowRepository).toBe(flowRepository);
    expect(container.flowService).toBeInstanceOf(FlowService);
  });

  it("allows tests to replace the singleton container", () => {
    const dispose = vi.fn();
    const container: ServerContainer = {
      config: createConfig({ databaseUrl: "file::memory:" }),
      flowRepository: createFakeFlowRepository(),
      flowService: new FlowService(createFakeFlowRepository()),
      dispose,
    };

    setServerContainerForTest(container);

    expect(getServerContainer()).toBe(container);

    resetServerContainerForTest();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("creates the directory for local file databases during composition", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ai-flow-builder-web-"));
    tempDirs.push(rootDir);
    const databasePath = join(rootDir, "nested", "ai-flow-builder.db");

    const container = createServerContainer({
      config: createConfig({ databaseUrl: `file:${databasePath}` }),
    });
    container.dispose();

    await expect(stat(join(rootDir, "nested"))).resolves.toMatchObject({
      isDirectory: expect.any(Function),
    });
  });
});

function createConfig(overrides: Pick<AppConfig, "databaseUrl">): AppConfig {
  return {
    nodeEnv: "test",
    databaseUrl: overrides.databaseUrl,
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
