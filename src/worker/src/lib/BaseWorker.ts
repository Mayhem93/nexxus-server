import {
  NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import { NexxusDatabaseAdapter, NexxusDatabaseAdapterEvents } from '@nexxus/database';
import { NexxusMessageQueueAdapter, NexxusMessageQueueAdapterEvents } from '@nexxus/message_queue';

export type NexxusBaseWorkerEvents = Record<string, any[]>;

export abstract class NexxusBaseWorker<T extends NexxusConfig, Ev extends NexxusBaseWorkerEvents = {}>
  extends NexxusBaseService<T, Ev extends NexxusBaseWorkerEvents ? Ev : NexxusBaseWorkerEvents> {

  protected static loggerLabel: Readonly<string> = "NxxWorker";

  protected database: NexxusDatabaseAdapter<NexxusConfig, NexxusDatabaseAdapterEvents>;
  protected messageQueue: NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;

  constructor() {
    super(NxxSvcs.configManager.getConfig('app') as T);

    this.database = NxxSvcs.database as NexxusDatabaseAdapter<NexxusConfig, NexxusDatabaseAdapterEvents>;
    this.messageQueue = NxxSvcs.messageQueue as NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;
  }
}
