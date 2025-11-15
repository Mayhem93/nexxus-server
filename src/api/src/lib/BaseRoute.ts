import { NexxusGlobalServices as NxxSvcs,
  NexxusConfig
} from '@nexxus/core';
import { NexxusMessageQueueAdapter, NexxusMessageQueueAdapterEvents } from '@nexxus/message_queue';
import { Router } from 'express';

export abstract class NexxusApiBaseRoute {
  protected messageQueue: NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;
  protected router: Router;
  protected basePath: string;

  constructor(basePath: string, parentRouter: Router) {
    this.messageQueue = NxxSvcs.messageQueue as NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;

    this.basePath = basePath;
    this.router = Router();
    this.registerRoutes();
    this.mountOn(parentRouter);
  }

  protected abstract registerRoutes(): void;

  private mountOn(parentRouter: Router): void {
    parentRouter.use(this.basePath, this.router);
  }
}
