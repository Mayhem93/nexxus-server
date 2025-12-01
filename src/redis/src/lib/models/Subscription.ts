import { NexxusRedis } from '../Redis';
import { NEXXUS_PREFIX_LC,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';

import crypto from 'crypto';

export type NexxusChannelFilter = Record<string, any>;

export interface NexxusSubscriptionChannel {
  appId: string;
  model?: string;
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
    }

    if (this.channel.userId) {
      key += `:user:${this.channel.userId}`;
    }

    if (this.filterId) {
      key += `:filter:${this.filterId}`;
    }

    return key;
  }

  public static async fromKey(key: string): Promise<NexxusRedisSubscription> {
    const parts = key.split(':');

    const appId = parts[2];
    let model: string | undefined;
    let userId: string | undefined;
    let filterId: string | undefined;

    for (let i = 3; i < parts.length; i++) {
      if (parts[i] === 'model') {
        model = parts[i + 1];
        i++;
      } else if (parts[i] === 'user') {
        userId = parts[i + 1];
        i++;
      } else if (parts[i] === 'filter') {
        filterId = parts[i + 1];
        i++;
      }
    }

    return new NexxusRedisSubscription({ appId, model, userId }, filterId);
  }


  async addDevice(deviceId: string): Promise<void> {
    const partition = this.getDevicePartition(deviceId);
    const key = this.buildPartitionKey(partition);
    const partitionIndexKey = this.buildPartitionIndexKey();

    const redis = (NxxSvcs.redis as NexxusRedis).getClient();

    // Add device to partition
    await redis.sAdd(key, deviceId);

    // Track that this partition exists
    await redis.sAdd(partitionIndexKey, partition);

    // If filtered subscription, store filter definition
    if (this.filterId && this.channel.filter) {
      const filterKey = this.buildFilterRegistryKey();

      await redis.hSet(filterKey, this.filterId, JSON.stringify(this.channel.filter));
    }
  }

  async removeDevice(deviceId: string): Promise<void> {
    const redis = (NxxSvcs.redis as NexxusRedis).getClient();
    const partition = this.getDevicePartition(deviceId);
    const key = this.buildPartitionKey(partition);

    await redis.sRem(key, deviceId);
    await redis.sRem(this.buildPartitionIndexKey(), partition);

    if (this.filterId) {
      await redis.hDel(this.buildFilterRegistryKey(), this.filterId);
    }
  }

  async getAllDevices(): Promise<Set<string>> {
    const devices = new Set<string>();
    const redis = (NxxSvcs.redis as NexxusRedis).getClient();
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
      deviceList.forEach(d => devices.add(d));
    });

    return devices;
  }

  // Private helpers
  private getDevicePartition(deviceId: string): string {
    const hash = crypto.createHash('sha256').update(deviceId).digest();
    const partitionNum = hash[0] % NexxusRedisSubscription.PARTITION_COUNT;

    return partitionNum.toString(16).toLowerCase();
  }

  private static generateFilterId(filter: NexxusChannelFilter): string {
    const normalized = JSON.stringify(filter, Object.keys(filter).sort());

    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }

/*   private static async getFilterFromId(filterId: string, appId: string, model?: string, userId?: string): Promise<NexxusChannelFilter | null> {
    const redis = (NxxSvcs.redis as NexxusRedis).getClient();
    let key = `${NEXXUS_PREFIX_LC}:subscription-filters:${appId}`;

    if (model) {
      key += `:model:${model}`;
    }

    if (userId) {
      key += `:user:${userId}`;
    }

    const res = await redis.hGet(key, filterId);

    if (!res) {
      return null;
    }

    return JSON.parse(res) as NexxusChannelFilter;
  } */

  private buildPartitionKey(partition: string): string {
    let key = `${NEXXUS_PREFIX_LC}:subscription:${this.channel.appId}`;

    if (this.channel.model) {
      key += `:model:${this.channel.model}`;
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
    let key = `${NEXXUS_PREFIX_LC}:subscription-filters:${this.channel.appId}`;

    if (this.channel.model) {
      key += `:model:${this.channel.model}`;
    }

    if (this.channel.userId) {
      key += `:user:${this.channel.userId}`;
    }

    return key;
  }
}
