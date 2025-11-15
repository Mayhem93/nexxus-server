import { NexxusGlobalServices as NxxSvcs } from '@nexxus/core';
import { NexxusApiBaseRoute } from '../BaseRoute';
import { NexxusApiRequest, NexxusApiResponse } from '../Api';

import { Router } from 'express';

export default class ApplicationRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/application', appRouter);
  }

  protected registerRoutes(): void {
    this.router.post('/', this.createApp.bind(this));
    this.router.get('/:appId',  this.getApp.bind(this));
    this.router.put('/:appId', this.updateApp.bind(this));
  }

  private async getApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(200).send({ message: 'Welcome to the Application Route!' });
  }

  private async createApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    await this.messageQueue.publishMessage('writer', { data: { appName: 'NewApp' }, event: 'app_created' });

    res.status(201).send({ message: 'Application created successfully!' });
  }

  private async updateApp(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(201).send({ message: 'Application updated successfully!' });
  }
}
