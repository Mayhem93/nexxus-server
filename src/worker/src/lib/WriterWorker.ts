import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import {
  NexxusQueueName,
  NexxusQueueMessage,
  NexxusQueuePayload
} from '@nexxus/message_queue';
import { NexxusBaseWorker, NexxusBaseWorkerEvents } from "./BaseWorker";

import * as path from "node:path";

type NexxusWriterWorkerConfig = NexxusConfig & {
  name: string;
}

type NexxusWriterWorkerEvents = NexxusBaseWorkerEvents & {
  message: [string];
};

export class NexxusWriterWorker extends NexxusBaseWorker<NexxusWriterWorkerConfig, NexxusWriterWorkerEvents> {
  private queueName : NexxusQueueName = "writer";

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
    await super.init(this.queueName);
  }

  protected async processMessage(msg: NexxusQueueMessage<NexxusQueuePayload<"writer">>): Promise<void> {
    NxxSvcs.logger.debug(`Processing message: ${JSON.stringify(msg.payload)}`, NexxusWriterWorker.loggerLabel);
  }
}
