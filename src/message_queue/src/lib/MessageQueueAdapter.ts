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

export type NexxusBasePayload = {
  nxx_payload: Record<string, any>;
}

export type NexxusWriterPayload = NexxusBasePayload & {
  nxx_payload: {
    event: string;
    data: Record<string, any>;
  };
}

export type NexxusQueueNames = 'writer';

export interface QueueToPayloadMapping {
  writer: NexxusWriterPayload;
}

export abstract class NexxusMessageQueueAdapter<T extends NexxusConfig, Ev extends NexxusMessageQueueAdapterEvents>
  extends NexxusBaseService<T, Ev extends NexxusMessageQueueAdapterEvents ? Ev : NexxusMessageQueueAdapterEvents> {

  protected static loggerLabel: Readonly<string> = "NxxMessageQueue";

  constructor() {
    super(NxxSvcs.configManager.getConfig('message_queue') as T);
  }

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract publishMessage(
    queueName: NexxusQueueNames,
    message: NexxusBasePayload
  ): Promise<void>;

  abstract consumeMessages(
    queueName: NexxusQueueNames,
    onMessage: (message: NexxusBasePayload) => Promise<void>
  ) : Promise<void>;
}
