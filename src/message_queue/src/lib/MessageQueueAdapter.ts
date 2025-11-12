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
    queueName: string,
    message: any
  ): Promise<void>;

  abstract consumeMessages(
    queueName: string,
    onMessage: (message: NexxusBasePayload) => Promise<void>
  ) : Promise<void>;
}
