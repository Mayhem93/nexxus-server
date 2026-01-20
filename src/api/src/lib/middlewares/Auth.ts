import {
  NexxusApi,
  NexxusApiRequest,
  NexxusApiResponse,
  NexxusApiUser
} from '../Api';
import {
  UserAuthenticationFailedException,
  NoAuthPresentException,
  UserTokenExpiredException
} from '../Exceptions';

import jwt from 'jsonwebtoken';
import type { NextFunction } from 'express';

/**
 * Middleware: Require JWT authentication (for all protected routes)
 */
export default (req: NexxusApiRequest, res: NexxusApiResponse, next: NextFunction) => {
  if (!NexxusApi.getStoredApp(req.headers['nxx-app-id'] as string)?.getData().authEnabled) {
    return next();
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  const apiConfig = NexxusApi.instance.getConfig();

  if (!token) {
    throw new NoAuthPresentException('No token provided');
  }

  try {
    req.user = jwt.verify(token, apiConfig.auth?.jwtSecret as string) as NexxusApiUser; // Attach user info to request

    next();
  } catch (e) {
    switch (e.name) {
      case 'TokenExpiredError':
        throw new UserTokenExpiredException('Token has expired');
      case 'JsonWebTokenError':
        throw new UserAuthenticationFailedException('Invalid token');
      default:
        throw e;
    }
  }
};
