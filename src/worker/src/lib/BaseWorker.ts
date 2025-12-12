import {
  NexxusGlobalServices as NxxSvcs,
  NexxusBaseService,
  NexxusConfig,
  NexxusQueueName,
  NexxusQueuePayload,
  NexxusBaseQueuePayload
} from '@nexxus/core';
import {
  NexxusDatabaseAdapter,
  NexxusDatabaseAdapterEvents
} from '@nexxus/database';
import { NexxusMessageQueueAdapter,
  NexxusMessageQueueAdapterEvents,
  NexxusQueueMessage
} from '@nexxus/message_queue';

export type NexxusBaseWorkerEvents = Record<string, any[]>;

export abstract class NexxusBaseWorker<T extends NexxusConfig, Ev extends NexxusBaseWorkerEvents = {}, TPayload extends NexxusBaseQueuePayload = NexxusBaseQueuePayload>
  extends NexxusBaseService<T, Ev extends NexxusBaseWorkerEvents ? Ev : NexxusBaseWorkerEvents> {

  protected static loggerLabel: Readonly<string> = "NxxWorker";

  protected abstract queueName: NexxusQueueName;
  protected database: NexxusDatabaseAdapter<NexxusConfig, NexxusDatabaseAdapterEvents>;
  protected messageQueue: NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;

  constructor() {
    super(NxxSvcs.configManager.getConfig('app') as T);

    this.database = NxxSvcs.database as NexxusDatabaseAdapter<NexxusConfig, NexxusDatabaseAdapterEvents>;
    this.messageQueue = NxxSvcs.messageQueue as NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;
  }

  public async init() : Promise<void> {
    await this.messageQueue.consumeMessages(this.queueName, this.processMessage.bind(this) as any);
  }

  protected async publish<Q extends NexxusQueueName>(
    queueName: Q,
    message: NexxusQueuePayload<Q>,
    metadata?: Record<string, any>
  ): Promise<void> {
    return await this.messageQueue.publishMessage(queueName, message, metadata);
  }

  protected abstract processMessage(payload: NexxusQueueMessage<TPayload>) : Promise<void>;
}
