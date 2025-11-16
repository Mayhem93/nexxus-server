import {
  ConfigCliArgs,
  ConfigEnvVars,
  FatalErrorException,
  NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import { NexxusApiBaseRoute } from './BaseRoute';
import { NotFoundMiddleware } from './middlewares';

import Express from 'express';
import helmet from 'helmet';

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { IncomingHttpHeaders, Server as HttpServer } from 'node:http';
import https from 'node:https';

type RouteConstructor = new (r: Express.Router) => NexxusApiBaseRoute;

type NexxusApiHeaders = {
  "nexxus-app-id"?: string;
};

export interface NexxusApiRequest extends Express.Request {
  headers: NexxusApiHeaders & IncomingHttpHeaders;
}

export interface NexxusApiResponse extends Express.Response {}

type NexxusApiConfig = {
  name: string;
  port: number;
  ssl?: {
    sslKeyPath: string;
    sslCertPath: string;
  };
} & NexxusConfig;

export class NexxusApi extends NexxusBaseService<NexxusApiConfig> {
  private static loggerLabel: Readonly<string> = "NxxApi";
  private app: Express.Express;
  private httpsServer?: https.Server;
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/api.schema.json");

  constructor() {
    super(NxxSvcs.configManager.getConfig('app') as NexxusApiConfig);

    this.app = Express();
    this.app.disable("x-powered-by");

    if (this.config.ssl !== undefined) {
      this.httpsServer = https.createServer({
        key: readFileSync(this.config.ssl.sslKeyPath),
        cert: readFileSync(this.config.ssl.sslCertPath)
      }, this.app);
    }
  }

  public async init(): Promise<void> {
    NxxSvcs.logger.info("Initializing API service...", NexxusApi.loggerLabel);

    this.app.use(helmet());
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

      if (!RouteClass) {
        throw new FatalErrorException(`Failed to load route class from file "${file}". Does it have a default export ?`);
      }

      new RouteClass(this.app);

      NxxSvcs.logger.debug(`Registered route class ${RouteClass.name}`, NexxusApi.loggerLabel);
    }

    this.app.use(NotFoundMiddleware);

    let server : HttpServer | https.Server;

    if (this.config.ssl !== undefined && this.httpsServer) {
      server = this.httpsServer;

      this.httpsServer.listen(this.config.port);
    } else {
      server = this.app.listen(this.config.port);
    }

    server.on("listening", () => {
      NxxSvcs.logger.info(`API service is listening on port ${this.config.port}`, NexxusApi.loggerLabel);
    });
  }
}
