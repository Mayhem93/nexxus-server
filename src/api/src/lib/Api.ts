import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';

import Express from 'express';

import * as path from "node:path";
import * as fs from "node:fs/promises";
import { NexxusApiBaseRoute } from './BaseRoute';

type RouteConstructor = new (r: Express.Router) => NexxusApiBaseRoute;

export class NexxusApi extends NexxusBaseService {
  private static loggerLabel: Readonly<string> = "NxxApi";
  private app: Express.Express;
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/api.schema.json");

  constructor(config: NexxusConfig) {
    super(config);

    this.app = Express();
  }

  public async init(): Promise<void> {
    NxxSvcs.logger.info("Initializing API service...", NexxusApi.loggerLabel);

    this.app.use(Express.json());
    this.app.use(Express.urlencoded({ extended: true }));

    const routesPath = path.join(__dirname, "./routes");
    const routeDirents = await fs.readdir(routesPath, { withFileTypes: true });
    const routeFiles = routeDirents
      .filter(dirent => dirent.isFile() && dirent.name.endsWith(".js"))
      .map(dirent => dirent.name);

    for (const file of routeFiles) {
      const RouteModule = await import(path.join(routesPath, file));
      const RouteClass: RouteConstructor = RouteModule.default;

      new RouteClass(this.app.router);

      NxxSvcs.logger.debug(`Registered route class ${RouteClass.name}`, NexxusApi.loggerLabel);
    }

    const server = this.app.listen(this.config.port);

    server.on("listening", () => {
      NxxSvcs.logger.info(`API service is listening on port ${this.config.port}`, NexxusApi.loggerLabel);
    });
  }
}
