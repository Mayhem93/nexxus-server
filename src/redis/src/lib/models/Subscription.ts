import { NexxusRedis } from '../Redis';
import { NEXXUS_PREFIX_LC } from '@nexxus/core';

import crypto from 'crypto';

export type NexxusDeviceTransportString = `${string}|${string}`; // deviceId|transport
export type NexxusChannelFilter = Record<string, any>;

export interface NexxusSubscriptionChannel {
  appId: string;
  model?: string;
  modelId?: string;
  userId?: string;
  filter?: NexxusChannelFilter | null;
}

export class NexxusRedisSubscription {
  private static readonly PARTITION_COUNT = 16;
  private channel: NexxusSubscriptionChannel;
  private filterId?: string;

  constructor(channel: NexxusSubscriptionChannel, filterId?: string) {
    this.channel = channel;

    // If channel has a filter, generate filter ID
    if (channel.filter) {
      this.filterId = NexxusRedisSubscription.generateFilterId(channel.filter);
    } else if (filterId) {
      this.filterId = filterId;
    }
  }

  public setAppId(appId: string): void {
    this.channel.appId = appId;
  }

  public getKey(): string {
    let key = `${NEXXUS_PREFIX_LC}:subscription:${this.channel.appId}`;

    if (this.channel.model) {
      key += `:model:${this.channel.model}`;

      if (this.channel.modelId) {
        key += `:${this.channel.modelId}`;
      }
    }

    // it's redundant to have both modelId and userId
    if (this.channel.userId && !this.channel.modelId ) {
      key += `:user:${this.channel.userId}`;
    }

    if (this.filterId) {
      key += `:filter:${this.filterId}`;
    }

    return key;
  }

  public static fromKey(key: string): NexxusRedisSubscription {
    const parts = key.split(':');

    const appId = parts[2];
    let model: string | undefined;
    let modelId: string | undefined;
    let userId: string | undefined;
    let filterId: string | undefined;

    for (let i = 3; i < parts.length; i++) {
      if (parts[i] === 'model') {
        model = parts[i + 1];

        if (i + 2 < parts.length && parts[i + 2] !== 'user' && parts[i + 2] !== 'filter') {
          modelId = parts[i + 2];
          i++;
        }

        i++;
      } else if (parts[i] === 'user') {
        userId = parts[i + 1];
        i++;
      } else if (parts[i] === 'filter') {
        filterId = parts[i + 1];
        i++;
      }
    }

    return new NexxusRedisSubscription({ appId, model, modelId, userId }, filterId);
  }


  public async addDevice(deviceId: string, transport: string): Promise<void> {
    const partition = this.getDevicePartition(deviceId);
    const key = this.buildPartitionKey(partition);
    const partitionIndexKey = this.buildPartitionIndexKey();

    const redis = NexxusRedis.instance.getClient();

    // Add device to partition
    await redis.sAdd(key, `${deviceId}|${transport}`);

    // Track that this partition exists
    await redis.sAdd(partitionIndexKey, partition);

    // If filtered subscription, store filter definition
    if (this.filterId && this.channel.filter) {
      const filterKey = this.buildFilterRegistryKey();

      await redis.hSet(filterKey, this.filterId, JSON.stringify(this.channel.filter));
    }
  }

  public async removeDevice(deviceId: string, transport: string): Promise<boolean> {
    const redis = NexxusRedis.instance.getClient();
    const partition = this.getDevicePartition(deviceId);
    const key = this.buildPartitionKey(partition);
    const removed = await redis.sRem(key, `${deviceId}|${transport}`);

    await redis.sRem(this.buildPartitionIndexKey(), partition);

    if (this.filterId) {
      await redis.hDel(this.buildFilterRegistryKey(), this.filterId);
    }

    return removed > 0;
  }

  public async getAllDevices(): Promise<Set<NexxusDeviceTransportString>> {
    const devices = new Set<NexxusDeviceTransportString>();
    const redis = NexxusRedis.instance.getClient();
    const partitionIndexKey = this.buildPartitionIndexKey();

    // Get list of partitions that have devices
    const activePartitions = await redis.sMembers(partitionIndexKey);

    if (activePartitions.length === 0) {
      return devices; // No devices subscribed
    }

    // Only fetch active partitions
    const promises = activePartitions.map(partition => {
      const key = this.buildPartitionKey(partition);

      return redis.sMembers(key);
    });

    const results = await Promise.all(promises);

    results.forEach(deviceList => {
      deviceList.forEach(d => devices.add(d as NexxusDeviceTransportString));
    });

    return devices;
  }

  public static *generateSubscriptionPatterns(data: {
    appId: string;
    userId?: string;
    model?: string;
    modelId?: string;
  }): Generator<NexxusSubscriptionChannel> {
    const { appId, userId, model, modelId } = data;

    // Level 1: App-only subscription
    yield { appId };

    // Level 2: Add userId dimension
    if (userId) {
      yield { appId, userId };
    }

    // Level 3: Add model dimension
    if (model) {
      yield { appId, model };

      // Level 4: Add modelId
      if (modelId) {
        yield { appId, model, modelId };
      }

      // Level 5: userId + model combination
      if (userId) {
        yield { appId, userId, model };

        // Level 6: userId + model + modelId (most specific)
        if (modelId) {
          yield { appId, userId, model, modelId };
        }
      }
    }
  }

  // Private helpers
  private getDevicePartition(deviceId: string): string {
    const hash = crypto.createHash('sha256').update(deviceId).digest();
    const partitionNum = hash[0] % NexxusRedisSubscription.PARTITION_COUNT;

    return partitionNum.toString(16).toLowerCase();
  }

  private static generateFilterId(filter: NexxusChannelFilter): string {
    //todo: deep sort
    const normalized = JSON.stringify(filter, Object.keys(filter).sort());

    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

  public static async getAllFilters(channel: NexxusSubscriptionChannel): Promise<Record<string, NexxusChannelFilter>> {
    const redis = NexxusRedis.instance.getClient();

    // Build the filter registry key for this channel
    const filterRegistryKey = this.buildFilterRegistryKey(channel);

    // Get all the filters
    const filters = await redis.hGetAll(filterRegistryKey);

    return Object.fromEntries(
      Object.entries(filters).map(([filterId, filterJson]) => [
        filterId,
        JSON.parse(filterJson) as NexxusChannelFilter
      ])
    );
  }

  private buildPartitionKey(partition: string): string {
    let key = `${NEXXUS_PREFIX_LC}:subscription:${this.channel.appId}`;

    if (this.channel.model) {
      key += `:model:${this.channel.model}`;

      if (this.channel.modelId) {
        key += `:${this.channel.modelId}`;
      }
    }

    if (this.channel.userId) {
      key += `:user:${this.channel.userId}`;
    }

    if (this.filterId) {
      key += `:filter:${this.filterId}`;
    }

    key += `:p${partition}`;

    return key;
  }

  private buildPartitionIndexKey(): string {
    let key = `${NEXXUS_PREFIX_LC}:subscription-partitions:${this.channel.appId}`;

    if (this.channel.model) {
      key += `:model:${this.channel.model}`;
    }

    if (this.channel.userId) {
      key += `:user:${this.channel.userId}`;
    }

    if (this.filterId) {
      key += `:filter:${this.filterId}`;
    }

    return key;
  }

  private buildFilterRegistryKey(): string {
    return NexxusRedisSubscription.buildFilterRegistryKey(this.channel);
  }

  private static buildFilterRegistryKey(channel: NexxusSubscriptionChannel): string {
    let key = `${NEXXUS_PREFIX_LC}:subscription-filters:${channel.appId}`;

    if (channel.model) {
      key += `:model:${channel.model}`;
    }

    if (channel.modelId) {
      key += `:${channel.modelId}`;
    }

    if (channel.userId) {
      key += `:user:${channel.userId}`;
    }

    return key;
  }
}
