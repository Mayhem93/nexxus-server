import { ModelNotFoundException } from '../Exceptions';
import { NexxusApiBaseRoute } from '../BaseRoute';
import { type NexxusApiRequest, type NexxusApiResponse, NexxusApi } from '../Api';
import { RequiredHeadersMiddleware, AppExistsMiddleware } from '../middlewares';
import {
  NexxusAppModel,
  type NexxusAppModelProps,
  type NexxusApplicationSchema
} from '@nexxus/database';

import { type Router } from 'express';

interface CreateAppModelRequest extends NexxusApiRequest {
  body: NexxusAppModelProps;
}

export default class ModelRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/model', appRouter);

    this.router.use(RequiredHeadersMiddleware('nxx-app-id'));
    this.router.use(RequiredHeadersMiddleware('nxx-device-id'));
    this.router.use(AppExistsMiddleware());
  }

  protected registerRoutes(): void {
    this.router.post('/', this.createModel.bind(this));
    this.router.get('/:modelId',  this.getModel.bind(this));
    this.router.put('/:modelId', this.updateModel.bind(this));
  }

  private async getModel(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(200).send({ message: 'Welcome to the Model Route!' });
  }

  private async createModel(req: CreateAppModelRequest, res: NexxusApiResponse): Promise<void> {
    const appId = req.headers['nxx-app-id'] as string;
    const appSchema = NexxusApi.getStoredApp(appId)?.getSchema() as NexxusApplicationSchema;

    if (!appSchema[req.body.type]) {
      throw new ModelNotFoundException(`Model "${req.body.type}" not found in schema for the application "${appId}"`);
    }

    const newModel = new NexxusAppModel(req.body);

    await this.messageQueue.publishMessage('writer', { data: newModel.getData(), event: 'model_created' });

    res.status(202).send({ message: 'Model created successfully!' });
  }

  private async updateModel(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    res.status(202).send({ message: 'Model updated successfully!' });
  }
}
