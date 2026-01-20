import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusQueueName,
  NexxusTransportManagerPayload,
  NexxusModelCreatedPayload,
  NexxusModelUpdatedPayload,
  NexxusModelDeletedPayload,
  NexxusBaseQueuePayload,
  NexxusFilterQuery,
  NexxusAppModelType,
  NexxusJsonPatch
} from '@nexxus/core';
import { NexxusQueueMessage } from '@nexxus/message_queue';
import {
  NexxusBaseSubscriptionChannel,
  NexxusRedisSubscription,
  NexxusDeviceTransportString
} from '@nexxus/redis';

import {
  NexxusBaseWorker,
  NexxusBaseWorkerEvents,
  NexxusWorkerServices
} from "./BaseWorker";

import * as path from "node:path";

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
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/transport-manager-worker.schema.json");

  constructor(services: NexxusWorkerServices) {
    super(services);
  }

  protected async processMessage(msg: NexxusQueueMessage<NexxusTransportManagerPayload>): Promise<void> {
    NexxusTransportManagerWorker.logger.debug(`Processing message: ${JSON.stringify(msg.payload)}`, NexxusTransportManagerWorker.loggerLabel);

    const payload = msg.payload;

    switch (payload.event) {
      case "model_created":
        await this.handleModelCreated(payload.data);

        break;
      case "model_updated":
        await this.handleModelUpdated(payload.data);

        NexxusTransportManagerWorker.logger.debug(`Processing model update with data: ${JSON.stringify(payload.data)}`, NexxusTransportManagerWorker.loggerLabel);

        break;

      case "model_deleted":
        await this.handleModelDeleted(payload.data);

        NexxusTransportManagerWorker.logger.debug(`Processing model delete with data: ${JSON.stringify(payload.data)}`, NexxusTransportManagerWorker.loggerLabel);

        break;
      default:
        NexxusTransportManagerWorker.logger.warn(`Unknown event type: ${(payload as NexxusBaseQueuePayload).event}`, NexxusTransportManagerWorker.loggerLabel);
    }
  }

  private async handleModelCreated(data: NexxusModelCreatedPayload['data']): Promise<void> {
    const devices = await this.getDevicesFromGeneratedChannels({
      appId: data.appId,
      userId: data.userId,
      model: data.type,
      modelId: data.id
    }, data);
    const transportToDeviceMap: Map<NexxusQueueName, Set<string>> = new Map();

    for (const device of devices) {
      const [id, transport] = device.split('|');

      if (!transportToDeviceMap.has(transport as NexxusQueueName)) {
        transportToDeviceMap.set(transport as NexxusQueueName, new Set());
      }

      transportToDeviceMap.get(transport as NexxusQueueName)!.add(id);
    }

    for (const [transport, deviceSet] of transportToDeviceMap.entries()) {

      this.publish(transport as NexxusQueueName, {
        event: 'device_message',
        deviceIds: Array.from(deviceSet.values()),
        data: {
          event: 'model_created',
          data
        }
      });

      NexxusTransportManagerWorker.logger.debug(
        `Notifying ${deviceSet.size} devices about create model ID: "${data.id}" via transport: "${transport}"`,
        NexxusTransportManagerWorker.loggerLabel
      );
    }
  }

  private async handleModelUpdated(data: NexxusModelUpdatedPayload['data']): Promise<void> {
    const patchInstances = data.map(patchData => new NexxusJsonPatch(patchData));
    const devices = await this.getDevicesFromGeneratedChannels({
      appId: data[0].metadata.appId,
      userId: data[0].metadata.userId,
      model: data[0].metadata.type,
      modelId: data[0].metadata.id
    }, patchInstances);
    const transportToDeviceMap: Map<NexxusQueueName, Set<string>> = new Map();

    for (const device of devices) {
      const [id, transport] = device.split('|');

      if (!transportToDeviceMap.has(transport as NexxusQueueName)) {
        transportToDeviceMap.set(transport as NexxusQueueName, new Set());
      }

      transportToDeviceMap.get(transport as NexxusQueueName)!.add(id);
    }

    for (const [transport, deviceSet] of transportToDeviceMap.entries()) {
      this.publish(transport as NexxusQueueName, {
        event: 'device_message',
        deviceIds: Array.from(deviceSet.values()),
        data: {
          event: 'model_updated',
          data
        }
      });

      NexxusTransportManagerWorker.logger.debug(
        `Notifying ${deviceSet.size} devices about update to model ID: "${data[0].metadata.id}" via transport: "${transport}"`,
        NexxusTransportManagerWorker.loggerLabel
      );
    }
  }

  private async handleModelDeleted(data: NexxusModelDeletedPayload['data']): Promise<void> {
    const devices = await this.getDevicesFromGeneratedChannels({
      appId: data.appId,
      userId: data.userId,
      model: data.type,
      modelId: data.id
    });
    const transportToDeviceMap: Map<NexxusQueueName, Set<string>> = new Map();

    for (const device of devices) {
      const [id, transport] = device.split('|');

      if (!transportToDeviceMap.has(transport as NexxusQueueName)) {
        transportToDeviceMap.set(transport as NexxusQueueName, new Set());
      }

      transportToDeviceMap.get(transport as NexxusQueueName)!.add(id);
    }

    for (const [transport, deviceSet] of transportToDeviceMap.entries()) {
      this.publish(transport as NexxusQueueName, {
        event: 'device_message',
        deviceIds: Array.from(deviceSet.values()),
        data: {
          event: 'model_deleted',
          data
        }
      });

      NexxusTransportManagerWorker.logger.debug(
        `Notifying ${deviceSet.size} devices about delete of model ID: "${data.id}" via transport: "${transport}"`,
        NexxusTransportManagerWorker.loggerLabel
      );
    }
  }

  private async getDevicesFromGeneratedChannels<T>(channel: NexxusBaseSubscriptionChannel, change?: T | T[]): Promise<Set<NexxusDeviceTransportString>> {
    const allDevices = new Set<NexxusDeviceTransportString>();
    const appSchema = NexxusTransportManagerWorker.loadedApps.get(channel.appId)?.getData().schema;

    if (!appSchema) {
      NexxusTransportManagerWorker.logger.warn(
        `Application schema not found for appId: "${channel.appId}" when getting devices for channel: ${JSON.stringify(channel)}`,
        NexxusTransportManagerWorker.loggerLabel
      );

      return allDevices;
    }

    // Normalize change to array for consistent processing
    const changes = change !== undefined
      ? (Array.isArray(change) ? change : [change])
      : [];

    // Step 1: Generate all base channels (without filters)
    const baseChannels = NexxusRedisSubscription.generateSubscriptionPatterns(channel);

    for (const channel of baseChannels) {
      // Get devices from unfiltered subscription
      const unfilteredSub = new NexxusRedisSubscription(channel);
      const unfilteredDevices = await unfilteredSub.getAllDevices();

      unfilteredDevices.forEach(deviceId => allDevices.add(deviceId));

      NexxusTransportManagerWorker.logger.debug(
        `Found ${unfilteredDevices.size} devices for unfiltered channel: ${JSON.stringify(channel)}`,
        NexxusTransportManagerWorker.loggerLabel
      );

      // If no changes (e.g., model deleted), skip filtered subscriptions
      if (changes.length > 0) {
        // Step 2: Get all filters for this channel
        const filters = await NexxusRedisSubscription.getAllFilters(channel);

        // Step 3: For each filter, test if ANY change matches
        for (const [filterId, filterQuery] of Object.entries(filters)) {
          const filter = new NexxusFilterQuery(filterQuery, { appModelDef: appSchema[channel.model] });

          // Test if ANY change matches the filter
          const matchesFilter = changes.some(singleChange => {
            let objectChange: Partial<NexxusAppModelType>;

            if (singleChange instanceof NexxusJsonPatch) {
              objectChange = singleChange.getPartialModel();
            } else {
              objectChange = singleChange as Partial<NexxusAppModelType>;
            }

            return filter.test(objectChange);
          });

          if (matchesFilter) {
            const filteredSub = new NexxusRedisSubscription(channel, filterId);
            const filteredDevices = await filteredSub.getAllDevices();

            filteredDevices.forEach(deviceId => allDevices.add(deviceId));

            NexxusTransportManagerWorker.logger.debug(
              `Found ${filteredDevices.size} devices for filtered channel: ${JSON.stringify(channel)} with filter: ${filterId}`,
              NexxusTransportManagerWorker.loggerLabel
            );
          }
        }
      }
    }

    NexxusTransportManagerWorker.logger.debug(
      `Total ${allDevices.size} unique devices to notify for update`,
      NexxusTransportManagerWorker.loggerLabel
    );

    return allDevices;
  }
}
