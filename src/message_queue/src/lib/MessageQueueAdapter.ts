import {
  NexxusConfig,
  NexxusBaseService,
  NexxusGlobalServices as NxxSvcs
} from "@nexxus/core";

export type NexxusMessageQueueAdapterEvents = {
  connect: [];
  disconnect: [];
  error: [Error];
  message: [any];
}

export type NexxusBasePayload =  Record<string, any>;

export type NexxusWriterPayload = NexxusBasePayload & {
  event: string;
  data: Record<string, any>;
}

export type NexxusQueueName = keyof NexxusKnownQueues | (string & {});

export type NexxusKnownQueues = {
  writer: NexxusWriterPayload;
}

export type NexxusQueuePayload<Q extends NexxusQueueName> =
  Q extends keyof NexxusKnownQueues ? NexxusKnownQueues[Q] : NexxusBasePayload;

export type NexxusQueueMessage<
  TPayload extends NexxusBasePayload,
  TMetadata = unknown
> = {
  payload: TPayload;
  metadata: TMetadata;
};

export abstract class NexxusMessageQueueAdapter<T extends NexxusConfig, Ev extends NexxusMessageQueueAdapterEvents>
  extends NexxusBaseService<T, Ev extends NexxusMessageQueueAdapterEvents ? Ev : NexxusMessageQueueAdapterEvents> {

  protected static loggerLabel: Readonly<string> = "NxxMessageQueue";

  constructor() {
    super(NxxSvcs.configManager.getConfig('message_queue') as T);
  }

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract publishMessage<Q extends NexxusQueueName>(
    queueName: Q,
    message: NexxusQueuePayload<Q>,
    metadata?: unknown
  ): Promise<void>;

  abstract consumeMessages<Q extends NexxusQueueName>(
    queueName: Q,
    onMessage: (message: NexxusQueueMessage<NexxusQueuePayload<Q>, unknown>) => Promise<void>
  ) : Promise<void>;
}
