import { NexxusGlobalServices as NxxSvcs } from '@nexxus/core';
import { NexxusDevice, NexxusDeviceProps } from '@nexxus/redis';
import { NexxusApiBaseRoute } from '../BaseRoute';
import { type NexxusApiRequest, type NexxusApiResponse } from '../Api';

import { type Router } from 'express';

import { randomUUID } from 'node:crypto';

type RegisterDeviceRequestBody = Omit<NexxusDeviceProps, 'id' | 'appId' | 'status' | 'lastSeen' | 'subscriptions'>;

interface RegisterDeviceRequest extends NexxusApiRequest {
  body: RegisterDeviceRequestBody;
}

export default class DeviceRoute extends NexxusApiBaseRoute {
  constructor(applicationRouter: Router) {
    super('/:appId/device', applicationRouter);
  }

  protected registerRoutes(): void {
    this.router.post('/register', this.registerDevice.bind(this));
    this.router.get('/:deviceId', this.getDevice.bind(this));
  }

  private async registerDevice(req: RegisterDeviceRequest, res: NexxusApiResponse): Promise<void> {
    const redisDevice = new NexxusDevice({
      id: randomUUID(),
      appId: req.params.appId,
      name: req.body.name,
      type: req.body.type,
      status: 'offline',
      lastSeen: new Date(0),
      subscriptions: []
    });

    await redisDevice.save();

    res.status(200).send({ message: 'Device registered successfully!' });
  }

  private async getDevice(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    await NexxusDevice.get('req.params.deviceId');

    res.status(200).send({ message: 'Device details retrieved successfully!' });
  }
}
