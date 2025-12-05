import { NexxusApiBaseRoute } from '../BaseRoute';
import { RequiredHeadersMiddleware, AppExistsMiddleware } from '../middlewares';
import {
  type NexxusApiRequest,
  type NexxusApiResponse,
  NexxusApi
} from '../Api';
import { InvalidParametersException } from '../Exceptions';
import { type NexxusApplicationModelType, NexxusApplication } from '@nexxus/database';
import { NexxusRedisSubscription } from '@nexxus/redis';

import { type Router } from 'express';

interface CreateApplicationRequest extends NexxusApiRequest {
  body: Pick<NexxusApplicationModelType, "name" | "description" | "schema">;
}

interface SubscribeRequest extends NexxusApiRequest {
  body: {
    model: string;
    userId?: string;
    filter?: Record<string, any>;
    getOnly?: boolean;
    limit?: number;
    offset?: number;
  }
}

export default class ApplicationRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/application', appRouter);
  }

  protected registerRoutes(): void {
    this.router.post('/', this.createApp.bind(this));
    this.router.get('/:appId',  this.getApp.bind(this));
    this.router.put('/:appId', this.updateApp.bind(this));
    this.router.post('/subscribe', this.subscribe.bind(this)).use(
      RequiredHeadersMiddleware('nxx-app-id'),
      RequiredHeadersMiddleware('nxx-device-id'),
      AppExistsMiddleware()
    );
  }

  private async subscribe(req: SubscribeRequest, res: NexxusApiResponse): Promise<void> {
    if (typeof req.body.model !== 'string' && req.body.model !== undefined) {
      throw new InvalidParametersException('Invalid model parameter');
    }

    if (typeof req.body.userId !== 'string' && req.body.userId !== undefined) {
      throw new InvalidParametersException('Invalid userId parameter');
    }

    if (req.body.limit === undefined) {
      req.body.limit = 10;
    } else {
      if (typeof req.body.limit !== 'number' || req.body.limit <= 0) {
        throw new InvalidParametersException('Invalid limit parameter');
      }
    }

    if (req.body.offset === undefined) {
      req.body.offset = 0;
    } else {
      if (typeof req.body.offset !== 'number' || req.body.offset < 0) {
        throw new InvalidParametersException('Invalid offset parameter');
      }
    }

    if (typeof req.body.getOnly !== 'boolean') {
      throw new InvalidParametersException('Invalid getOnly parameter');
    }

    req.body.getOnly = req.body.getOnly || false;

    const app = NexxusApi.getStoredApp(req.headers['nxx-app-id'] as string);

    if (!app) { //TODO: specific app not found exception
      throw new InvalidParametersException(`Application "${req.headers['nxx-app-id'] as string}" not found`);
    }

    if (req.body.model && app.getData().schema[req.body.model] === undefined) {
      throw new InvalidParametersException(`Model "${req.body.model}" not found in application "${req.headers['nxx-app-id'] as string}"`);
    }

    const sub = new NexxusRedisSubscription({
      appId: req.headers['nxx-app-id'] as string,
      model: req.body.model,
      userId: req.body.userId,
      filter: req.body.filter
    });

    await sub.addDevice(req.headers['nxx-device-id'] as string);

    await this.database.searchItems({
      model: req.body.model,
      query: {}
    });

    res.status(200).send({ message: 'Subscribe endpoint hit successfully!' });
  }

  private async getApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(200).send({ message: 'Welcome to the Application Route!' });
  }

  private async createApp(req: CreateApplicationRequest, res: NexxusApiResponse): Promise<void> {
    if (!req.body.schema || typeof req.body.schema !== 'object') {
      throw new InvalidParametersException('Invalid or missing schema in request body');
    }

    const newApp = new NexxusApplication(req.body as NexxusApplicationModelType);

    await this.messageQueue.publishMessage('writer', { data: newApp.getData(), event: 'app_created' });

    res.status(202).send({ message: 'Application created successfully!' });
  }

  private async updateApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(202).send({ message: 'Application updated successfully!' });
  }
}
