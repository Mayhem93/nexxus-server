import { NexxusApiException, ServerErrorException } from '../Exceptions';
import { NexxusException } from '@nexxus/core';

import { Request, Response, NextFunction } from 'express';

export default async (err: NexxusApiException, req: Request, res: Response, next: NextFunction) : Promise<void> => {
  if (!(err instanceof NexxusException)) {
    err = new ServerErrorException('An unexpected server error occurred.');
  }

  const statusCode = err.statusCode || 500;
  const errorResponse = {
    error: err.name,
    message: err.message,
    ...(process.env.NODE_ENV === 'dev' && { stack: err.stack })
  };

  res.status(statusCode).json(errorResponse);
};
