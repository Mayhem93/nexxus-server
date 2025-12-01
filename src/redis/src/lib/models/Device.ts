import { NexxusRedis } from '../Redis';
import { NexxusRedisBaseModel, RedisKeyType } from './BaseModel';
import { NexxusRedisSubscription } from './Subscription';
import { NEXXUS_PREFIX_LC, NexxusGlobalServices as NxxSvcs } from '@nexxus/core';

import crypto from 'crypto';

export interface NexxusDeviceProps {
  id: string;
  appId: string;
  name: string;
  type: "volatile" | "persistent" | "unknown";
  status: 'online' | 'offline' | 'unknown';
  lastSeen: Date;
  subscriptions: NexxusRedisSubscription[];
}

type NexxusDeviceConstructorProps = Omit<NexxusDeviceProps, 'subscriptions'> & {
  subscriptions: NexxusRedisSubscription[] | [];
}

type NexxusDeviceRedisProps = Omit<NexxusDeviceProps, 'lastSeen' | 'subscriptions'> & {
  lastSeen: string;
  subscriptions: string[];
}

export class NexxusDevice extends NexxusRedisBaseModel<NexxusDeviceProps> {
  constructor(props: NexxusDeviceConstructorProps) {
    super(RedisKeyType.Json, {
      id: props.id || crypto.randomUUID(),
      appId: props.appId,
      name: props.name || 'Unnamed Device',
      type: props.type || 'unknown',
      status: props.status || 'unknown',
      lastSeen: new Date(props.lastSeen || 0),
      subscriptions: props.subscriptions || []
    });

    if (!props.appId) {
      throw new Error('Device must have an appId');
    }
  }

  public getKey(): string {
    return `${NEXXUS_PREFIX_LC}:device:${this.val.id}`;
  }

  public static async get(id : string, withSubscriptions: boolean = false): Promise<NexxusDevice> {
    const res = await (NxxSvcs.redis as NexxusRedis).getClient().json.get(`${NEXXUS_PREFIX_LC}:device:${id}`) as NexxusDeviceRedisProps | null;

    if (!res) {
      throw new Error(`Device with id "${id}" not found`);
    }

    const device = new NexxusDevice({
      ...res,
      lastSeen: new Date(res.lastSeen),
      subscriptions: withSubscriptions ? await Promise.all(res.subscriptions.map(async (subKey) => {
        const sub = await NexxusRedisSubscription.fromKey(subKey);

        sub.setAppId(res.appId);

        return sub;
      })) : []
    });

    return device;
  }

  public async addSubscription(subscription: NexxusRedisSubscription): Promise<boolean> {
    const redis = (NxxSvcs.redis as NexxusRedis).getClient();

    subscription.setAppId(this.val.appId);

    const index = await this.hasSubscription(subscription);

    if (index !== null) {
      NxxSvcs.logger.debug(`Subscription "${subscription.getKey()}" already exists on device with id "${this.val.id}"`);

      return false;
    }

    const res = await redis.json.arrAppend(
      `${NEXXUS_PREFIX_LC}:device:${this.val.id}`,
      '$.subscriptions',
      subscription.getKey()
    );

    if (res === null) {
      throw new Error(`Failed to add subscription to device with id "${this.val.id}"`);
    }

    this.val.subscriptions.push(subscription);
    await subscription.addDevice(this.val.id);

    NxxSvcs.logger.debug(`Added subscription to device with id "${this.val.id}"`);

    return true;
  }

  public async hasSubscription(subscription: NexxusRedisSubscription): Promise<number | null> {
    subscription.setAppId(this.val.appId);

    const localSearchIndex = this.val.subscriptions.findIndex(sub => {
      return sub.getKey() === subscription.getKey();
    });

    if (localSearchIndex !== -1) {
      return localSearchIndex;
    }

    const subs = await (NxxSvcs.redis as NexxusRedis).getClient().json.get(
      `${NEXXUS_PREFIX_LC}:device:${this.val.id}`,
      { path: '$.subscriptions' }
    ) as string[] | null;

    if (subs === null) {
      throw new Error(`Device with id "${this.val.id}" not found`);
    }

    const index = subs.indexOf(subscription.getKey());

    return index !== -1 ? index : null;
  }

  public async removeSubscription(subscription: NexxusRedisSubscription): Promise<boolean> {
    subscription.setAppId(this.val.appId);

    const index = await this.hasSubscription(subscription);

    if (index === null) {
      NxxSvcs.logger.debug(`Subscription "${subscription.getKey()}" not found on device with id "${this.val.id}"`);

      return false;
    }

    const res = await (NxxSvcs.redis as NexxusRedis).getClient().json.arrPop(
      `${NEXXUS_PREFIX_LC}:device:${this.val.id}`,
      {
        path: `$.subscriptions`,
        index: index
      }
    );

    if (res === null) {
      throw new Error(`Failed to remove subscription from device with id "${this.val.id}"`);
    }

    await subscription.removeDevice(this.val.id);

    this.val.subscriptions.splice(index, 1);

    NxxSvcs.logger.debug(`Removed subscription from device with id "${this.val.id}"`);

    return true;
  }

  public async save(): Promise<void> {
    const subscriptionKeys : string[] = this.val.subscriptions.map(sub => sub.getKey());
    const res = await (NxxSvcs.redis as NexxusRedis).getClient().json.set(this.getKey(), '$', {
      ...this.val,
      lastSeen: this.val.lastSeen.toISOString(),
      subscriptions: subscriptionKeys
    });

    for (const subInstance of this.val.subscriptions) {
      await subInstance.addDevice(this.val.id);
    }

    if (!res) {
      throw new Error(`Failed to save device with id "${this.val.id}"`);
    }

    NxxSvcs.logger.debug(`Saved device with id "${this.val.id}"`);
  }
}
