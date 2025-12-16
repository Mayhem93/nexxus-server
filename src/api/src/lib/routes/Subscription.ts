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
  ModelNotFoundException,
  DeviceNotConnectedException
} from '../Exceptions';
import {
  RedisKeyNotFoundException,
  NexxusRedisSubscription,
  NexxusDevice,
  RedisDeviceNotConnectedException
} from '@nexxus/redis';

import { type Router } from 'express';

type SubscribeRequestBody = {
  model: string;
  userId?: string;
  filter?: Record<string, any>;
  getOnly?: boolean;
  limit?: number;
  offset?: number;
};

type UnsubscribeRequestBody = Omit<SubscribeRequestBody, 'limit' | 'offset' | 'getOnly'>;

interface SubscribeRequest extends NexxusApiRequest {
  body: SubscribeRequestBody;
}

interface UnsubscribeRequest extends NexxusApiRequest {
  body: UnsubscribeRequestBody;
}

export default class SubscriptionRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/subscription', appRouter);

    this.router.use(
      RequiredHeadersMiddleware('nxx-app-id'),
      RequiredHeadersMiddleware('nxx-device-id'),
      AppExistsMiddleware()
    );
  }

  protected registerRoutes(): void {
    this.router.post('/', this.subscribe.bind(this));
    this.router.delete('/', this.unsubscribe.bind(this));
  }

  private async subscribe(req: SubscribeRequest, res: NexxusApiResponse): Promise<void> {
    const appId = req.headers['nxx-app-id'] as string;
    const deviceId = req.headers['nxx-device-id'] as string;

    if (!req.body.model || typeof req.body.model !== 'string') {
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

    if (typeof req.body.getOnly !== 'boolean' && req.body.getOnly !== undefined) {
      throw new InvalidParametersException('Invalid getOnly parameter');
    }

    req.body.getOnly = req.body.getOnly || false;

    const app = NexxusApi.getStoredApp(appId);

    if (app!.getData().schema[req.body.model] === undefined) {
      throw new ModelNotFoundException(`Model "${req.body.model}" not found in application "${appId}"`);
    }

    if (req.body.getOnly === false) {
      const sub = new NexxusRedisSubscription({
        appId,
        model: req.body.model,
        userId: req.body.userId,
        filter: req.body.filter
      });

      try {
        const device = await NexxusDevice.get(deviceId, true);

        await device.addSubscription(sub);
      } catch (e) {
        if (e instanceof RedisKeyNotFoundException) {
          throw new NotFoundException(`Device with id "${deviceId}" not found`);
        } else if (e instanceof RedisDeviceNotConnectedException) {
          throw new DeviceNotConnectedException(`Device with id "${deviceId}" is not connected to any transport`);
        }

        throw e;
      }
    }

    const results = (await NexxusApi.database.searchItems({
      model: req.body.model,
      query: {
        appId
      }
    })).map(item => item.getData());

    res.status(200).send({ results });
  }

  private async unsubscribe(req: UnsubscribeRequest, res: NexxusApiResponse): Promise<void> {}
}
