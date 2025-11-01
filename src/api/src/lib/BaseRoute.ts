import { Router } from "express";

export abstract class NexxusApiBaseRoute {
  protected router: Router;

  constructor(r: Router) {
    this.router = r;
  }

  protected abstract registerRoutes(): void;
}
