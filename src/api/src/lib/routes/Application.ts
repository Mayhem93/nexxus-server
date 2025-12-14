import { NexxusApiBaseRoute } from '../BaseRoute';
import { RequiredHeadersMiddleware, AppExistsMiddleware } from '../middlewares';
import {
  type NexxusApiRequest,
  type NexxusApiResponse,
  NexxusApi
} from '../Api';
import {
  InvalidParametersException,
  NotFoundException,
  ModelNotFoundException
} from '../Exceptions';
import {
  type NexxusApplicationModelType,
  NexxusApplication
} from '@nexxus/core';
import {
  RedisKeyNotFoundException,
  NexxusRedisSubscription,
  NexxusDevice
} from '@nexxus/redis';

import { type Router } from 'express';

interface CreateApplicationRequest extends NexxusApiRequest {
  body: Pick<NexxusApplicationModelType, "name" | "description" | "schema">;
}

export default class ApplicationRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/application', appRouter);
  }

  protected registerRoutes(): void {
    /* this.router.post('/', this.createApp.bind(this)); */
    this.router.get('/:appId',  this.getApp.bind(this));
    this.router.put('/:appId', this.updateApp.bind(this));
  }

  private async getApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(200).send({ message: 'Welcome to the Application Route!' });
  }

  /* private async createApp(req: CreateApplicationRequest, res: NexxusApiResponse): Promise<void> {
    if (!req.body.schema || typeof req.body.schema !== 'object') {
      throw new InvalidParametersException('Invalid or missing schema in request body');
    }

    const newApp = new NexxusApplication(req.body as NexxusApplicationModelType);

    await NexxusApi.messageQueue.publishMessage('writer', { data: newApp.getData(), event: 'app_created' });

    res.status(202).send({ message: 'Application created successfully!' });
  } */

  private async updateApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(202).send({ message: 'Application updated successfully!' });
  }
}
