import {
  DrizzleFlowRepository,
  flows,
  type FlowDatabase,
  type FlowRepository,
} from "@ai-flow-builder/db";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getAppConfig, type AppConfig } from "./config.js";
import { FlowService } from "./services/flow-service.js";

export interface ServerContainer {
  config: AppConfig;
  flowRepository: FlowRepository;
  flowService: FlowService;
  dispose(): void;
}

export interface ServerContainerOptions {
  config?: AppConfig;
  flowRepository?: FlowRepository;
  flowService?: FlowService;
  databaseClient?: Client;
  now?: () => Date;
}

let singletonContainer: ServerContainer | null = null;

export function getServerContainer(): ServerContainer {
  singletonContainer ??= createServerContainer();
  return singletonContainer;
}

export function setServerContainerForTest(
  container: ServerContainer | null,
): void {
  singletonContainer?.dispose();
  singletonContainer = container;
}

export function resetServerContainerForTest(): void {
  singletonContainer?.dispose();
  singletonContainer = null;
}

export function createServerContainer(
  options: ServerContainerOptions = {},
): ServerContainer {
  const config = options.config ?? getAppConfig();

  if (options.flowRepository !== undefined) {
    const flowService =
      options.flowService ?? new FlowService(options.flowRepository);
    return {
      config,
      flowRepository: options.flowRepository,
      flowService,
      dispose: () => undefined,
    };
  }

  ensureLocalDatabaseDirectory(config.databaseUrl);

  const ownsClient = options.databaseClient === undefined;
  const client =
    options.databaseClient ?? createClient({ url: config.databaseUrl });
  const database: FlowDatabase = drizzle(client, { schema: { flows } });
  const repositoryOptions =
    options.now === undefined ? {} : { now: options.now };
  const flowRepository = new DrizzleFlowRepository(database, repositoryOptions);
  const flowService = options.flowService ?? new FlowService(flowRepository);

  return {
    config,
    flowRepository,
    flowService,
    dispose: () => {
      if (ownsClient) {
        client.close();
      }
    },
  };
}

function ensureLocalDatabaseDirectory(databaseUrl: string): void {
  const databasePath = localDatabasePath(databaseUrl);
  if (databasePath === null || databasePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
}

function localDatabasePath(databaseUrl: string): string | null {
  if (!databaseUrl.startsWith("file:")) {
    return null;
  }

  const rawFilePath = databaseUrl.slice("file:".length);
  if (rawFilePath.startsWith("//")) {
    return fileURLToPath(databaseUrl);
  }

  return rawFilePath;
}
