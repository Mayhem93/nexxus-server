import { NexxusApiBaseRoute } from "../BaseRoute";

import { Router, Request, Response } from "express";

export default class RootRoute extends NexxusApiBaseRoute {
  constructor(r: Router) {
    super(r);
    this.registerRoutes();
  }

  protected registerRoutes(): void {
    this.router.get("/", (req: Request, res: Response) => {
      res.status(200).send({ message: "Welcome to the Nexxus API!" });
    });
  }
}
