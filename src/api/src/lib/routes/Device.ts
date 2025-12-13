import { NexxusDevice, NexxusDeviceProps } from '@nexxus/redis';
import { NexxusApiBaseRoute } from '../BaseRoute';
import {
  type NexxusApiRequest,
  type NexxusApiResponse,
  NexxusApi
} from '../Api';
import { RequiredHeadersMiddleware } from '../middlewares';
import { InvalidParametersException, NotFoundException } from '../Exceptions';

import { type Router } from 'express';

import { randomUUID } from 'node:crypto';

type RegisterDeviceRequestBody = Omit<NexxusDeviceProps, 'id' | 'appId' | 'status' | 'lastSeen' | 'subscriptions' | 'connectedTo' | 'type'>;

interface RegisterDeviceRequest extends NexxusApiRequest {
  body: RegisterDeviceRequestBody;
}

export default class DeviceRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/device', appRouter);
  }

  protected registerRoutes(): void {
    this.router.use(RequiredHeadersMiddleware('nxx-app-id'));

    this.router.post('/register', this.registerDevice.bind(this));
    this.router.get('/',
      RequiredHeadersMiddleware('nxx-device-id'),
      this.getDevice.bind(this)
    );
  }

  private async registerDevice(req: RegisterDeviceRequest, res: NexxusApiResponse): Promise<void> {
    if (!req.body.name || typeof req.body.name !== 'string') {
      throw new InvalidParametersException('Invalid or missing device name in request body');
    }

    if (NexxusApi.getStoredApp(req.headers['nxx-app-id'] as string) === undefined) {
      throw new NotFoundException(`Application with ID ${req.headers['nxx-app-id']} does not exist`);
    }

    const nxxDevice = new NexxusDevice({
      id: randomUUID(),
      appId: req.headers['nxx-app-id'] as string,
      name: req.body.name,
      status: 'offline',
      lastSeen: (new Date(0)).toDateString(),
      subscriptions: []
    });

    await nxxDevice.save();

    res.status(200).send({ message: 'Device registered successfully!' });
  }

  private async getDevice(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    // await NexxusDevice.get('req.params.deviceId');

    res.status(200).send({ message: 'Device details retrieved successfully!' });
  }
}
