import { NexxusApiException, ServerErrorException } from '../Exceptions';
import { NexxusApi } from '../Api';
import { FatalErrorException, NexxusException } from '@nexxus/core';

import { Request, Response, NextFunction } from 'express';

export default async (err: NexxusApiException, req: Request, res: Response, next: NextFunction) : Promise<void> => {
  if (!(err instanceof NexxusException)) {
    err = new ServerErrorException('An unexpected server error occurred.');
  }

  if (err instanceof FatalErrorException) {
    err = new ServerErrorException('A fatal server error occurred.');
  }

  if (err.statusCode >= 500) {
    NexxusApi.logger.error(`${err.message}\n${err.stack}`, 'NxxApi');
  }

  const statusCode = err.statusCode || 500;
  const errorResponse = {
    error: err.name,
    message: err.message,
    ...(process.env.NODE_ENV === 'dev' && { stack: err.stack })
  };

  res.status(statusCode).json(errorResponse);
};
