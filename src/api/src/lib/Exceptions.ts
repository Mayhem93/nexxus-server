import { NexxusException } from "@nexxus/core";

enum NexxusApiExceptions {
  INVALID_PARAMETERS = "InvalidParametersException",
  SERVER_ERROR = "ServerErrorException"
};

export abstract class NexxusApiException extends NexxusException {
  public abstract readonly statusCode: number;

  constructor(name: NexxusApiExceptions, message: string) {
    super(name, message);
  }
}

export class InvalidParametersException extends NexxusApiException {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(NexxusApiExceptions.INVALID_PARAMETERS, message);
  }
}

export class ServerErrorException extends NexxusApiException {
  public readonly statusCode = 500;

  constructor(message: string) {
    super(NexxusApiExceptions.SERVER_ERROR, message);
  }
}
