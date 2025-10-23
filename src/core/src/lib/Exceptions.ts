export enum NexxusExceptions {
  FATAL_ERROR = "FatalErrorException",
  BAD_REQUEST = "BadRequestException",
  CONNECTION_ERROR = "ConnectionErrorException",
  INVALID_CONFIG = "InvalidConfigException"
};

export class NexxusException extends Error {
  constructor(type: NexxusExceptions, message: string) {
    super(message);
    this.name = type;
  }
}

export class FatalErrorException extends NexxusException {
  constructor(message: string) {
    super(NexxusExceptions.FATAL_ERROR, message);
  }
}

export class BadRequestException extends NexxusException {
  constructor(message: string) {
    super(NexxusExceptions.BAD_REQUEST, message);
  }
}

export class ConnectionException extends NexxusException {
  constructor(message: string) {
    super(NexxusExceptions.CONNECTION_ERROR, message);
  }
}

export class InvalidConfigException extends NexxusException {
  constructor(message: string) {
    super(NexxusExceptions.INVALID_CONFIG, message);
  }
}
