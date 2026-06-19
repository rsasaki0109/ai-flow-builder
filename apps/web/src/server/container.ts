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
import { createAppLogger, type AppLogger } from "./logger.js";
import { FlowService } from "./services/flow-service.js";
import { GenerateCodeService } from "./services/generate-code-service.js";
import {
  createAiProvider,
  GenerateFlowFromTextService,
} from "./services/generate-flow-service.js";
import { RunFlowService } from "./services/run-flow-service.js";
import { createTextGenerationService } from "./services/text-generation-service.js";
import type { AiProvider } from "@ai-flow-builder/ai";
import type { TextGenerationService } from "@ai-flow-builder/flow-engine";

export interface ServerContainer {
  config: AppConfig;
  logger: AppLogger;
  flowRepository: FlowRepository;
  aiProvider: AiProvider;
  flowService: FlowService;
  runFlowService: RunFlowService;
  generateFlowService: GenerateFlowFromTextService;
  generateCodeService: GenerateCodeService;
  textGenerationService: TextGenerationService;
  dispose(): void;
}

export interface ServerContainerOptions {
  config?: AppConfig;
  flowRepository?: FlowRepository;
  aiProvider?: AiProvider;
  flowService?: FlowService;
  runFlowService?: RunFlowService;
  generateFlowService?: GenerateFlowFromTextService;
  generateCodeService?: GenerateCodeService;
  textGenerationService?: TextGenerationService;
  databaseClient?: Client;
  logger?: AppLogger;
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
  const logger = options.logger ?? createAppLogger({ level: config.logLevel });

  if (options.flowRepository !== undefined) {
    const aiProvider = options.aiProvider ?? createAiProvider(config);
    const textGenerationService =
      options.textGenerationService ?? createTextGenerationService(config);
    const flowService =
      options.flowService ?? new FlowService(options.flowRepository);
    const runFlowService =
      options.runFlowService ??
      new RunFlowService(options.flowRepository, {
        textGenerationService,
        timeoutMs: config.flowRunTimeoutMs,
      });
    const generateFlowService =
      options.generateFlowService ??
      new GenerateFlowFromTextService({
        aiProvider,
        timeoutMs: config.aiRequestTimeoutMs,
      });
    const generateCodeService =
      options.generateCodeService ??
      new GenerateCodeService(options.flowRepository);

    return {
      config,
      logger,
      flowRepository: options.flowRepository,
      aiProvider,
      flowService,
      runFlowService,
      generateFlowService,
      generateCodeService,
      textGenerationService,
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
  const aiProvider = options.aiProvider ?? createAiProvider(config);
  const textGenerationService =
    options.textGenerationService ?? createTextGenerationService(config);
  const flowService = options.flowService ?? new FlowService(flowRepository);
  const runFlowService =
    options.runFlowService ??
    new RunFlowService(flowRepository, {
      textGenerationService,
      timeoutMs: config.flowRunTimeoutMs,
    });
  const generateFlowService =
    options.generateFlowService ??
    new GenerateFlowFromTextService({
      aiProvider,
      timeoutMs: config.aiRequestTimeoutMs,
    });
  const generateCodeService =
    options.generateCodeService ?? new GenerateCodeService(flowRepository);

  return {
    config,
    logger,
    flowRepository,
    aiProvider,
    flowService,
    runFlowService,
    generateFlowService,
    generateCodeService,
    textGenerationService,
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
