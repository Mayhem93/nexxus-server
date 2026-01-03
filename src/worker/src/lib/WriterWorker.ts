import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusQueueName,
  NexxusWriterPayload,
  NexxusAppModel,
  NexxusJsonPatch,
  NexxusBaseQueuePayload
} from '@nexxus/core';
import { NexxusQueueMessage } from '@nexxus/message_queue';
import {
  NexxusBaseWorker,
  NexxusBaseWorkerEvents,
  NexxusWorkerServices
} from "./BaseWorker";

import * as path from "node:path";

type NexxusWriterWorkerConfig = NexxusConfig & {
  name: string;
}

type NexxusWriterWorkerEvents = NexxusBaseWorkerEvents & {
  message: [string];
};

export class NexxusWriterWorker extends NexxusBaseWorker<NexxusWriterWorkerConfig, NexxusWriterWorkerEvents, NexxusWriterPayload> {
  protected queueName : NexxusQueueName = 'writer';
  protected static loggerLabel: Readonly<string> = 'NxxWriterWorker';
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, '../../src/schemas/writer-worker.schema.json');

  constructor(services: NexxusWorkerServices) {
    super(services);
  }

  protected async processMessage(msg: NexxusQueueMessage<NexxusWriterPayload>): Promise<void> {
    NexxusWriterWorker.logger.debug(`Processing message: ${JSON.stringify(msg.payload)}`, NexxusWriterWorker.loggerLabel);

    const payload = msg.payload;

    switch (payload.event) {
      case "model_created": {

        const appModel = new NexxusAppModel(payload.data);

        await NexxusWriterWorker.database.createItems( [ appModel ] );

        this.publish('transport-manager', {
          event: 'model_created',
          data: appModel.getData(),
        });

        break;
      }
      case 'model_updated': {

        const jsonPatch = new NexxusJsonPatch(payload.data);
        const updateUpdatedAtPatch = new NexxusJsonPatch({
          op: 'replace',
          path: [ 'updatedAt' ],
          value: [ Math.floor(new Date().getTime() / 1000) ],
          metadata: jsonPatch.get().metadata
        });

        await NexxusWriterWorker.database.updateItems( [ jsonPatch, updateUpdatedAtPatch ] );

        this.publish('transport-manager', {
          event: 'model_updated',
          data: jsonPatch.get(),
        });

        break;
      }
      case 'model_deleted': {
        const appModel = new NexxusAppModel(payload.data);

        await NexxusWriterWorker.database.deleteItems([ appModel ] );

        this.publish('transport-manager', {
          event: 'model_deleted',
          data: payload.data,
        });

        break;
      }
      default:
        NexxusWriterWorker.logger.warn(`Unknown event type: ${(payload as NexxusBaseQueuePayload).event}`, NexxusWriterWorker.loggerLabel);
    }
  }
}
