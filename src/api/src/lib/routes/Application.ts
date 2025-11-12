import { Request, Response, Router } from 'express';
import { NexxusApiBaseRoute } from '../BaseRoute';

export default class ApplicationRoute extends NexxusApiBaseRoute {
  constructor(appRouter: Router) {
    super('/application', appRouter);
  }

  protected registerRoutes(): void {
    this.router.get('/',  this.rootEndpoint.bind(this));
  }

  private rootEndpoint(req: Request, res: Response): void {
    res.status(200).send({ message: 'Welcome to the Application Route!' });
  }
}
