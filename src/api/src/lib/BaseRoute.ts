import { Router } from 'express';

export abstract class NexxusApiBaseRoute {
  protected router: Router;
  protected basePath: string;

  constructor(basePath: string, parentRouter: Router) {
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
