import {
  NexxusApi,
  NexxusApiRequest,
  NexxusApiResponse,
  NexxusApiUser
} from '../Api';
import {
  UserAuthenticationFailedException,
  NoAuthPresentException
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

  req.user = jwt.verify(token, apiConfig.auth?.jwtSecret as string) as NexxusApiUser; // Attach user info to request

  if (req.user) {
    return next();
  }

  throw new UserAuthenticationFailedException('Invalid or expired token');
};
