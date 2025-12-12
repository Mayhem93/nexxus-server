import {
  NexxusConfig,
  NexxusBaseService,
  NexxusQueueName,
  NexxusQueuePayload,
  NexxusBaseQueuePayload,
  NexxusGlobalServices as NxxSvcs
} from "@nexxus/core";

export type NexxusMessageQueueAdapterEvents = {
  connect: [];
  disconnect: [];
  error: [Error];
  message: [any];
}

export interface NexxusQueueMessage<TPayload = NexxusBaseQueuePayload> {
  payload: TPayload;
  metadata?: Record<string, any>;
}

export abstract class NexxusMessageQueueAdapter<T extends NexxusConfig, Ev extends NexxusMessageQueueAdapterEvents>
  extends NexxusBaseService<T, Ev extends NexxusMessageQueueAdapterEvents ? Ev : NexxusMessageQueueAdapterEvents> {

  protected static loggerLabel: Readonly<string> = "NxxMessageQueue";
  protected abstract reconnectDelayMs: number;

  constructor() {
    super(NxxSvcs.configManager.getConfig('message_queue') as T);
  }

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract publishMessage<Q extends NexxusQueueName>(
    queueName: Q,
    message: NexxusQueuePayload<Q>,
    metadata?: Record<string, any>
  ): Promise<void>;

  abstract consumeMessages<Q extends NexxusQueueName>(
    queueName: Q,
    onMessage: (message: NexxusQueueMessage<NexxusQueuePayload<Q>>) => Promise<void>
  ) : Promise<void>;
}
