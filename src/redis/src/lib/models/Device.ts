import { NexxusRedisBaseModel, RedisKeyType } from './BaseModel';
import { NEXXUS_PREFIX_LC } from '@nexxus/core';

export interface NexxusDeviceProps {
  id: string;
  appId: string;
  name: string;
  type: "volatile" | "persistent" | "unknown";
  status: 'online' | 'offline' | 'unknown';
  lastSeen: Date;
  subscriptions: string[];
}

export class NexxusDevice extends NexxusRedisBaseModel<NexxusDeviceProps> {
  constructor(props: NexxusDeviceProps) {
    super(RedisKeyType.Json, props);
  }

  protected getKey(): string {
    return `${NEXXUS_PREFIX_LC}:device:${this.val.id}`;
  }

  public static async get(id : string): Promise<NexxusDevice> {
    const res = await this.redis.getClient().json.get(`${NEXXUS_PREFIX_LC}:device:${id}`) as NexxusDeviceProps | null;

    if (!res) {
      throw new Error(`Device with id "${id}" not found`);
    }

    return new NexxusDevice(res);
  }

  public async save(): Promise<void> {
    const res = await NexxusDevice.redis.getClient().json.set(this.getKey(), '$', JSON.stringify(this.val));

    if (!res) {
      throw new Error(`Failed to save device with id "${this.val.id}"`);
    }
  }
}
