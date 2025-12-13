export enum RedisKeyType {
  Hash = 'hash',
  String = 'string',
  List = 'list',
  Set = 'set',
  ZSet = 'zset',
  Json = 'json'
}

export abstract class NexxusRedisBaseModel<V> {
  protected redisKeyType : RedisKeyType;
  protected val: V;

  constructor(keyType: RedisKeyType, val: V) {
    this.redisKeyType = keyType;
    this.val = val;
  }

  public getValue(): V {
    return this.val;
  }

  public abstract save(): Promise<void>;
  public abstract getKey(): string;
}
