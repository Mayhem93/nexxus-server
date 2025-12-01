import { NexxusException } from "@nexxus/core";

enum ApiExceptions {
  INVALID_PARAMETERS = "InvalidParametersException",
  NOT_FOUND = "NotFoundException",
  SERVER_ERROR = "ServerErrorException"
};

export abstract class NexxusApiException extends NexxusException {
  public abstract readonly statusCode: number;

  constructor(name: ApiExceptions, message: string) {
    super(name, message);
  }
}

export class InvalidParametersException extends NexxusApiException {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(ApiExceptions.INVALID_PARAMETERS, message);
  }
}

export class ServerErrorException extends NexxusApiException {
  public readonly statusCode = 500;

  constructor(message: string) {
    super(ApiExceptions.SERVER_ERROR, message);
  }
}
export class NotFoundException extends NexxusApiException {
  public readonly statusCode = 404;

  constructor(message: string) {
    super(ApiExceptions.NOT_FOUND, message);
  }
}
