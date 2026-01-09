import { NexxusApiBaseRoute } from '../BaseRoute';
import {
  InvalidAuthMethodException,
  InvalidParametersException,
  UserAlreadyExistsException
} from '../Exceptions';
import {
  type NexxusApiRequest,
  type NexxusApiResponse,
  NexxusApi
} from '../Api';
import {
  RequiredHeadersMiddleware,
  AppExistsMiddleware,
  AuthMiddleware
} from '../middlewares';

import type { Router, RequestHandler } from 'express';
import { InvalidJsonPatchException, NexxusJsonPatch, NexxusJsonPatchType, NexxusUserModelType } from '@nexxus/core';
import { NexxusAuthStrategy } from '../auth';

type UserRegisterRequestBody = {
  username: string;
  password: string;
  [key: string]: any; // Additional user fields specified by app schema
};

type UserUpdateRequestBody = {
  patch: Omit<NexxusJsonPatchType, 'metadata'>;
}

interface UserRegisterRequest extends NexxusApiRequest {
  body: UserRegisterRequestBody;
}

interface UserUpdateRequest extends NexxusApiRequest {
  body: UserUpdateRequestBody;
}

export default class UserRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/user', appRouter);
  }

  protected registerRoutes(): void {
    this.router.use(RequiredHeadersMiddleware('nxx-app-id') as RequestHandler);
    this.router.use(AppExistsMiddleware() as RequestHandler);

    this.router.post('/register',
      this.register.bind(this) as RequestHandler
    );
    this.router.post('/login',
      this.login.bind(this) as RequestHandler
    );

    this.router.get('/me',
      AuthMiddleware as RequestHandler,
      this.me.bind(this) as RequestHandler
    );
    this.router.put('/',
      AuthMiddleware as RequestHandler,
      this.update.bind(this) as RequestHandler
    );
  }

  private async me(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    const { iat, exp, aud, iss, ...userData } = req.user!;

    NexxusApi.logger.debug(`Fetching current user data: ${JSON.stringify(req.user!)}`, 'UserRoute');

    res.status(200).json(userData);
  }

  private async register(req: UserRegisterRequest, res: NexxusApiResponse): Promise<void> {
    const appId = req.headers['nxx-app-id'] as string;
    const { username, password, ...additionalFields } = req.body;

    // Check if local strategy is available
    if (!NexxusApi.instance.hasAuthStrategy('local')) {
      throw new InvalidAuthMethodException('Local authentication not supported');
    }

    // Validate required fields
    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      throw new InvalidParametersException('Username and password are required');
    }

    // Get the local strategy instance
    const localStrategy = NexxusApi.instance.getAuthStrategy('local');
    const existingUser = await localStrategy.findUserByUsername(appId, username);

    if (existingUser) {
      throw new UserAlreadyExistsException('User with this username already exists');
    }

    // Create new user
    const user = await localStrategy.createUser(appId, {
      username,
      password,
      authProvider: 'local',
      details: additionalFields
    });

    res.status(200).json({
      message: 'User created successfully',
      user: {
        id: user.getData().id,
        username: user.getData().username
      }
    });
  }

  private async update(req: UserUpdateRequest, res: NexxusApiResponse): Promise<void> {
    if (req.body.patch === undefined || typeof req.body.patch !== 'object') {
      throw new InvalidParametersException('Invalid or missing patch data');
    }

    const appId = req.headers['nxx-app-id'] as string;
    const app = NexxusApi.getStoredApp(appId);

    // find if password is being updated
    // TODO: need to validate patch before this step to avoid potential issues
    const passwordUpdateIndex = req.body.patch.path.findIndex(p => p === 'password');

    if (passwordUpdateIndex !== -1) {
      req.body.patch.value[passwordUpdateIndex] = NexxusAuthStrategy.hashPassword(req.body.patch.value[passwordUpdateIndex]);
    }

    const jsonPatch = new NexxusJsonPatch({
      ...req.body.patch,
      metadata: {
        appId,
        id: req.user!.id,
        type: 'user'
      }
    });

    try {
      jsonPatch.validate({ modelType: 'user', userDetailsSchema: app?.getUserDetailSchema() });

      await NexxusApi.database.updateItems([ jsonPatch ]);

      res.status(200).json({ message: 'User updated successfully' });
    } catch (e) {
      if (e instanceof InvalidJsonPatchException) {
        throw new InvalidParametersException(`Invalid JSON Patch: ${e.message}`);
      }

      throw e;
    }
  }

  private async login(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {}
}
