import {
  NexxusGlobalServices as NxxSvcs,
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusQueueName,
  NexxusTransportManagerPayload
} from '@nexxus/core';
import { NexxusQueueMessage } from '@nexxus/message_queue';
import {
  NexxusDevice,
  NexxusRedisSubscription,
  NexxusDeviceTransportString
} from '@nexxus/redis';

import { NexxusBaseWorker, NexxusBaseWorkerEvents } from "./BaseWorker";

type NexxusTransportManagerWorkerConfig = NexxusConfig & {
  name: string;
}

type NexxusTransportManagerWorkerEvents = NexxusBaseWorkerEvents & {
  message: [string];
}

export class NexxusTransportManagerWorker extends NexxusBaseWorker<NexxusTransportManagerWorkerConfig, NexxusTransportManagerWorkerEvents, NexxusTransportManagerPayload> {
  protected queueName : NexxusQueueName = "transport-manager";
  protected static loggerLabel: Readonly<string> = "NxxTransportManagerWorker";
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };

  constructor() {
    super();
  }

  protected async processMessage(msg: NexxusQueueMessage<NexxusTransportManagerPayload>): Promise<void> {
    NxxSvcs.logger.debug(`Processing message: ${JSON.stringify(msg.payload)}`, NexxusTransportManagerWorker.loggerLabel);

    const payload = msg.payload;

    switch (payload.event) {
      case "notification_send":
        await this.handleNotificationSend(payload.data);

        NxxSvcs.logger.info(`Sending notification with data: ${JSON.stringify(payload.data)}`, NexxusTransportManagerWorker.loggerLabel);
        break;

      default:
        NxxSvcs.logger.warn(`Unknown event type: ${payload.event}`, NexxusTransportManagerWorker.loggerLabel);
    }
  }

  private async handleNotificationSend(data: NexxusTransportManagerPayload['data']): Promise<void> {
    const allDevices = new Set<NexxusDeviceTransportString>();

    // Step 1: Generate all base channels (without filters)
    const baseChannels = NexxusRedisSubscription.generateSubscriptionPatterns({
      appId: data.appId,
      userId: data.userId,
      model: data.model,
      modelId: data.id
    });

    for (const channel of baseChannels) {
      // Get devices from unfiltered subscription
      const unfilteredSub = new NexxusRedisSubscription(channel);
      const unfilteredDevices = await unfilteredSub.getAllDevices();

      unfilteredDevices.forEach(deviceId => allDevices.add(deviceId));

      NxxSvcs.logger.debug(
        `Found ${unfilteredDevices.size} devices for unfiltered channel: ${JSON.stringify(channel)}`,
        NexxusTransportManagerWorker.loggerLabel
      );

      // Step 2: Get all filters for this channel
      const filters = await NexxusRedisSubscription.getAllFilters(channel);

      // Step 3: For each filter, get devices from filtered subscription
      for (const filterId of Object.keys(filters)) {
        if (true) { //TODO: apply filter matching logic here
          const filteredSub = new NexxusRedisSubscription(channel, filterId);
          const filteredDevices = await filteredSub.getAllDevices();

          filteredDevices.forEach(deviceId => allDevices.add(deviceId));

          NxxSvcs.logger.debug(
            `Found ${filteredDevices.size} devices for filtered channel: ${JSON.stringify(channel)} with filter: ${filterId}`,
            NexxusTransportManagerWorker.loggerLabel
          );
        }
      }
    }

    NxxSvcs.logger.debug(
      `Total ${allDevices.size} unique devices to notify for update`,
      NexxusTransportManagerWorker.loggerLabel
    );

    for (const device of allDevices) {
      const [id, transport] = device.split('|');

      this.publish(transport as NexxusQueueName, {
        event: 'device_message',
        data: data
      });

      NxxSvcs.logger.debug(
        `Notifying device: "${device}" about update to model ID: "${data.id}" via transport: "${transport}"`,
        NexxusTransportManagerWorker.loggerLabel
      );
    }
  }
}
