import { NexxusException } from "@nexxus/core";

enum NexxusRedisExceptions {
  REDIS_CONNECTION_ERROR = "RedisConnectionErrorException",
  REDIS_COMMAND_ERROR = "RedisCommandErrorException",
  REDIS_KEY_NOT_FOUND = "RedisKeyNotFoundException"
};

export class NexxusRedisException extends NexxusException {
  constructor(name: string, message: string) {
    super(name, message);
  }
}

export class RedisConnectionErrorException extends NexxusRedisException {
  constructor(message: string) {
    super(NexxusRedisExceptions.REDIS_CONNECTION_ERROR, message);
  }
}

export class RedisCommandErrorException extends NexxusRedisException {
  constructor(message: string) {
    super(NexxusRedisExceptions.REDIS_COMMAND_ERROR, message);
  }
}

export class RedisKeyNotFoundException extends NexxusRedisException {
  constructor(message: string) {
    super(NexxusRedisExceptions.REDIS_KEY_NOT_FOUND, message);
  }
}
