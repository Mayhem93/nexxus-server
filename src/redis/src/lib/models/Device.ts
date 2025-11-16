import { NexxusRedisBaseModel, RedisKeyType } from './BaseModel';
import { NEXXUS_PREFIX_LC } from '@nexxus/core';

export interface NexxusDeviceProps {
  id: string;
  applicationId: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'unknown';
  lastSeen: Date;
  subscriptions: string[];
}

export class NexxusDevice extends NexxusRedisBaseModel {
  constructor(private props: NexxusDeviceProps) {
    super(RedisKeyType.Json);
  }

  get(param: keyof NexxusDeviceProps) {
    return this.props[param];
  }

  getKey(): string {
    return `${NEXXUS_PREFIX_LC}:device:${this.props.id}`;
  }
}
