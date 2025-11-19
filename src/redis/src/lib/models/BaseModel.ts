import {
  NexxusGlobalServices as NxxSvcs,
  NEXXUS_PREFIX_LC
} from '@nexxus/core';
import { type NexxusRedis } from '../Redis';

export enum RedisKeyType {
  Hash = 'hash',
  String = 'string',
  List = 'list',
  Set = 'set',
  ZSet = 'zset',
  Json = 'json'
}

type RedisKeyValueType = Record<string, any> | string | unknown;

export abstract class NexxusRedisBaseModel<V> {
  protected redisKeyType : RedisKeyType;
  protected val: V;
  protected static redis: NexxusRedis = NxxSvcs.redis as NexxusRedis;

  constructor(keyType: RedisKeyType, val: V) {
    this.redisKeyType = keyType;
    this.val = val;
  }

  public getValue(): V {
    return this.val;
  }

  public abstract save(): Promise<void>;
  protected abstract getKey(): string;
}
