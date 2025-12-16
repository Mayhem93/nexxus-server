import { InvalidParametersException, ModelNotFoundException } from '../Exceptions';
import { NexxusApiBaseRoute } from '../BaseRoute';
import { type NexxusApiRequest, type NexxusApiResponse, NexxusApi } from '../Api';
import { RequiredHeadersMiddleware, AppExistsMiddleware } from '../middlewares';
import {
  NexxusAppModel,
  NexxusJsonPatch,
  type NexxusAppModelType,
  type NexxusApplicationSchema,
  InvalidJsonPatchException,
  NexxusJsonPatchType
} from '@nexxus/core';

import { type Router } from 'express';

interface CreateAppModelRequest extends NexxusApiRequest {
  body: NexxusAppModelType;
}

type UpdateAppModelBody = {
  type: string;
  patch: Omit<NexxusJsonPatchType, 'metadata'>;
}

interface UpdateAppModelRequest extends NexxusApiRequest {
  body: UpdateAppModelBody;
  params: {
    id: string;
  }
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
    this.router.get('/:id',  this.getModel.bind(this));
    this.router.put('/:id', this.updateModel.bind(this));
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

    const newModel = new NexxusAppModel({
      ...req.body,
      appId: appId
    });

    await NexxusApi.messageQueue.publishMessage('writer', { event: 'model_created', data: newModel.getData() });

    res.status(202).send({ message: 'Model created successfully!' });
  }

  private async updateModel(req: UpdateAppModelRequest, res: NexxusApiResponse): Promise<void> {
    const appId = req.headers['nxx-app-id'] as string;
    const appSchema = NexxusApi.getStoredApp(appId)?.getSchema() as NexxusApplicationSchema;

    if (!appSchema[req.body.type]) {
      throw new ModelNotFoundException(`Model "${req.body.type}" not found in schema for the application "${appId}"`);
    }

    try {
      const jsonPatch = new NexxusJsonPatch({
        ...req.body.patch,
        metadata: {
          appId,
          id: req.params.id,
          type: req.body.type
        }
      });

      jsonPatch.validate(appSchema);

      await NexxusApi.messageQueue.publishMessage('writer', { event: 'model_updated', data: jsonPatch.get() });

      res.status(202).send({ message: 'Model updated successfully!' });
    } catch (error) {
      if (error instanceof InvalidJsonPatchException) {
        throw new InvalidParametersException(`Invalid JSON Patch: ${error.message}`);
      }

      throw error;
    }
  }
}
