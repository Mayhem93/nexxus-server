import {
  NexxusGlobalServices as NxxSvcs,
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusQueueName,
  NexxusWriterPayload,
  NexxusTransportManagerPayload
} from '@nexxus/core';
import {
  NexxusApplication,
  NexxusApplicationModelType,
  MODEL_REGISTRY
} from '@nexxus/database';
import { NexxusQueueMessage } from '@nexxus/message_queue';
import { NexxusBaseWorker, NexxusBaseWorkerEvents } from "./BaseWorker";

import * as path from "node:path";

type NexxusWriterWorkerConfig = NexxusConfig & {
  name: string;
}

type NexxusWriterWorkerEvents = NexxusBaseWorkerEvents & {
  message: [string];
};

export class NexxusWriterWorker extends NexxusBaseWorker<NexxusWriterWorkerConfig, NexxusWriterWorkerEvents, NexxusWriterPayload> {
  protected queueName : NexxusQueueName = "writer";
  private static readonly loadedApps: Map<string, NexxusApplication> = new Map();

  protected static loggerLabel: Readonly<string> = "NxxWriterWorker";
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/worker.schema.json");

  constructor() {
    super();
  }

  public async init() : Promise<void> {
    await super.init();
    await this.loadApps();
  }

  protected async processMessage(msg: NexxusQueueMessage<NexxusWriterPayload>): Promise<void> {
    NxxSvcs.logger.debug(`Processing message: ${JSON.stringify(msg.payload)}`, NexxusWriterWorker.loggerLabel);

    const payload = msg.payload;

    switch (payload.event) {
      case "app_created":
        NxxSvcs.logger.info(`Received app_created event for app ID: ${payload.data.id}`, NexxusWriterWorker.loggerLabel);

        const newApp = new NexxusApplication(payload.data as NexxusApplicationModelType);

        await this.database.createItems([ newApp ]);

        break;
      default:
        NxxSvcs.logger.warn(`Unknown event type: ${payload.event}`, NexxusWriterWorker.loggerLabel);
    }
    // await this.database.createItems()

    // await this.publish('mqtt')
  }

  private async loadApps(): Promise<void> {
    const results = await this.database.searchItems({ model: MODEL_REGISTRY.application, query: {} });

    for (let app of results) {
      NexxusWriterWorker.loadedApps.set(app.getData().id as string, app);
    }

    NxxSvcs.logger.info(`Loaded ${NexxusWriterWorker.loadedApps.size} applications into Worker service`, NexxusWriterWorker.loggerLabel);
  }
}
