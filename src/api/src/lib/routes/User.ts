import { NexxusApiBaseRoute } from '../BaseRoute';
import { InvalidAuthMethodException, InvalidParametersException, UserAlreadyExistsException } from '../Exceptions';
import { type NexxusApiRequest, type NexxusApiResponse, NexxusApi } from '../Api';
import { RequiredHeadersMiddleware, AppExistsMiddleware, AuthMiddleware } from '../middlewares';

import type { Router, RequestHandler } from 'express';

type UserRegisterRequestBody = {
  username: string;
  password: string;
  [key: string]: any; // Additional user fields specified by app schema
};

interface UserRegisterRequest extends NexxusApiRequest {
  body: UserRegisterRequestBody;
}

export default class UserRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/user', appRouter);
  }

  protected registerRoutes(): void {
    this.router.use(RequiredHeadersMiddleware('nxx-app-id') as RequestHandler);
    this.router.use(AppExistsMiddleware() as RequestHandler);

    this.router.post('/register',
      RequiredHeadersMiddleware('nxx-device-id') as RequestHandler,
      this.register.bind(this) as RequestHandler
    );
    this.router.get('/me',
      AuthMiddleware as RequestHandler,
      this.me.bind(this) as RequestHandler
    );
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
      deviceId: req.headers['nxx-device-id'] as string,
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

  private async me(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    const { iat, exp, ...userData } = req.user!;

    res.status(200).json(userData);
  }
}
