export enum RedisKeyType {
  Hash = 'hash',
  String = 'string',
  List = 'list',
  Set = 'set',
  ZSet = 'zset',
  Json = 'json'
}

export abstract class NexxusRedisBaseModel {
  protected redisKeyType : RedisKeyType;

  constructor(keyType: RedisKeyType) {
    this.redisKeyType = keyType;
  }

  public abstract getKey(): string;
}
