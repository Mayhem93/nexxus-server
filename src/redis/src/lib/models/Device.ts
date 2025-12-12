import { NexxusRedis } from '../Redis';
import {
  RedisCommandErrorException,
  RedisKeyNotFoundException,
  RedisDeviceInvalidParamsException,
  RedisDeviceNotConnectedException
} from '../Exceptions'
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
  connectedTo: string | null;
  lastSeen: Date;
  subscriptions: NexxusRedisSubscription[];
}

type NexxusDeviceConstructorProps = Omit<NexxusDeviceProps, 'lastSeen' |'subscriptions' | 'connectedTo' | 'type'> & {
  type?: "volatile" | "persistent" | "unknown";
  connectedTo?: string | null;
  lastSeen?: string;
  subscriptions: NexxusRedisSubscription[] | [];
}

type NexxusDeviceUpdateProps = Omit<Partial<NexxusDeviceProps>, 'id' | 'appId' | 'subscriptions'>;

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
      connectedTo: props.connectedTo || null,
      lastSeen: new Date(props.lastSeen || 0),
      subscriptions: props.subscriptions || []
    });

    if (!props.appId) {
      throw new RedisDeviceInvalidParamsException('appId is required to create a Device instance');
    }
  }

  public getKey(): string {
    return NexxusDevice.getKey(this.val.id);
  }

  public static getKey(id: string): string {
    return `${NEXXUS_PREFIX_LC}:device:${id}`;
  }

  public static async get(id : string, withSubscriptions: boolean = false): Promise<NexxusDevice> {
    const res = await (NxxSvcs.redis as NexxusRedis).getClient().json.get(`${NEXXUS_PREFIX_LC}:device:${id}`) as NexxusDeviceRedisProps | null;

    if (!res) {
      throw new RedisKeyNotFoundException(`Device with id "${id}" not found`);
    }

    const device = new NexxusDevice({
      ...res,
      subscriptions: withSubscriptions ? await Promise.all(res.subscriptions.map(async (subKey) => {
        const sub = NexxusRedisSubscription.fromKey(subKey);

        sub.setAppId(res.appId);

        return sub;
      })) : []
    });

    return device;
  }

  public static async update(id: string, updates: NexxusDeviceUpdateProps): Promise<void> {
    const redis = (NxxSvcs.redis as NexxusRedis).getClient();
    const key = this.getKey(id);
    const jsonUpdates : Array<{ key: string, path: string, value: any }> = [];

    for (const [field, value] of Object.entries(updates)) {
      const typedField = field as keyof NexxusDeviceUpdateProps;

      switch (typedField) {
        case 'lastSeen':
          if (!(value instanceof Date)) {
            throw new RedisDeviceInvalidParamsException(`Invalid value for lastSeen: expected Date, got ${typeof value}`);
          }

          jsonUpdates.push({ key, path: `$.${field}`, value: (value as Date).toISOString() });

          break;
        case 'name':
        case 'type':
        case 'status':
          if (typeof value !== 'string') {
            throw new RedisDeviceInvalidParamsException(`Invalid value for ${field}: expected string, got ${typeof value}`);
          }

          jsonUpdates.push({ key, path: `$.${field}`, value });

          break;
        default:
          throw new RedisDeviceInvalidParamsException(`Unknown field "${field}"`);
      }
    }

    const res = await redis.json.mSet(jsonUpdates);

    if (!res) {
      throw new RedisCommandErrorException(`Failed to update device with id "${id}"`);
    }

    NxxSvcs.logger.debug(`Updated device with id "${id}"`);
  }

  public static async removeDeviceSubscriptions(deviceId: string): Promise<void> {
    const device = await NexxusDevice.get(deviceId, true);
    const promises : Promise<boolean>[] = [];

    for (const subInstance of device.val.subscriptions) {
      if (device.val.connectedTo) {
        promises.push(subInstance.removeDevice(deviceId, device.val.connectedTo));
      } else {
        NxxSvcs.logger.warn(`Device with id "${deviceId}" is not connected to any transport, cannot remove subscriptions`);
      }
    }

    const result = await Promise.all(promises);
    const removedCount = result.filter(r => r).length;

    NxxSvcs.logger.debug(`Removed ${removedCount} subscriptions from device with id "${deviceId}"`);
  }

  public async addSubscription(subscription: NexxusRedisSubscription): Promise<boolean> {
    if (!this.val.connectedTo) {
      throw new RedisDeviceNotConnectedException(`Device with id "${this.val.id}" is not connected to any transport`);
    }

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
      throw new RedisCommandErrorException(`Failed to add subscription to device with id "${this.val.id}"`);
    }

    this.val.subscriptions.push(subscription);
    await subscription.addDevice(this.val.id, this.val.connectedTo);

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
      throw new RedisKeyNotFoundException(`Device with id "${this.val.id}" not found`);
    }

    const index = subs.indexOf(subscription.getKey());

    return index !== -1 ? index : null;
  }

  public async removeSubscription(subscription: NexxusRedisSubscription): Promise<boolean> {
    if (!this.val.connectedTo) {
      throw new RedisDeviceNotConnectedException(`Device with id "${this.val.id}" is not connected to any transport`);
    }

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
      throw new RedisCommandErrorException(`Failed to remove subscription from device with id "${this.val.id}"`);
    }

    await subscription.removeDevice(this.val.id, this.val.connectedTo);

    this.val.subscriptions.splice(index, 1);

    NxxSvcs.logger.debug(`Removed subscription from device with id "${this.val.id}"`);

    return true;
  }

  public async save(): Promise<void> {
    if (this.val.subscriptions.length > 0 && !this.val.connectedTo) {
      throw new RedisDeviceNotConnectedException(`Device with id "${this.val.id}" must be connected to a transport to have subscriptions`);
    }

    const subscriptionKeys : string[] = this.val.subscriptions.map(sub => sub.getKey());
    const res = await (NxxSvcs.redis as NexxusRedis).getClient().json.set(this.getKey(), '$', {
      ...this.val,
      lastSeen: this.val.lastSeen.toISOString(),
      subscriptions: subscriptionKeys
    });

    for (const subInstance of this.val.subscriptions) {
      await subInstance.addDevice(this.val.id, this.val.connectedTo!);
    }

    if (!res) {
      throw new RedisCommandErrorException(`Failed to save device with id "${this.val.id}"`);
    }

    NxxSvcs.logger.debug(`Saved device with id "${this.val.id}"`);
  }
}
