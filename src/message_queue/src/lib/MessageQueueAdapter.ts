import {
  NexxusConfig,
  NexxusBaseService
} from "@nexxus/core";

export enum NexxusMessageQueueAdapterEvents {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error",
  MESSAGE = "message"
}

export abstract class NexxusMessageQueueAdapter<T extends NexxusConfig> extends NexxusBaseService<T> {
  protected static loggerLabel: Readonly<string> = "NxxMessageQueue";
  constructor(config: T) {
    super(config);
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
    onMessage: (message: any) => Promise<void>
  ): Promise<void>;
}
