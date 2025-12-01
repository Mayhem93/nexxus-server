import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import { NexxusApplication,
  NexxusDatabaseAdapter,
  NexxusDatabaseAdapterEvents
} from '@nexxus/database';
import {
  RootRoute,
  ApplicationRoute,
  DeviceRoute
} from './routes';
import {
  NotFoundMiddleware,
  ErrorMiddleware
} from './middlewares';

import Express from 'express';
import helmet from 'helmet';

import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { IncomingHttpHeaders, Server as HttpServer } from 'node:http';
import https from 'node:https';

export type NexxusApiHeaders = {
  'nxx-app-id'?: Readonly<string>;
  'nxx-device-id'?: Readonly<string>;
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
  private app: Express.Express;
  private httpsServer?: https.Server;
  private static readonly loadedApps: Map<string, NexxusApplication> = new Map();
  private static loggerLabel: Readonly<string> = 'NxxApi';
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, '../../src/schemas/api.schema.json');
  public static instance?: NexxusApi;
  public readonly database = NxxSvcs.database as NexxusDatabaseAdapter<NexxusConfig, NexxusDatabaseAdapterEvents>;

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
    NxxSvcs.logger.info('Initializing API service...', NexxusApi.loggerLabel);

    this.app.use(helmet({
      xDownloadOptions: false,
      xXssProtection: false,
      xDnsPrefetchControl: false,
      xFrameOptions: false,
      originAgentCluster: false,
      referrerPolicy: { policy: 'same-origin' },
      strictTransportSecurity: this.config.ssl !== undefined ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      } : false
    }));
    this.app.use(Express.json());
    this.app.use(Express.urlencoded({ extended: true }));

    await this.loadApps();

    new RootRoute(this.app);

    const appRoute = new ApplicationRoute(this.app);

    new DeviceRoute(appRoute.getRouter());

    this.app.use(NotFoundMiddleware);
    this.app.use(ErrorMiddleware);

    let server : HttpServer | https.Server;

    if (this.config.ssl !== undefined && this.httpsServer) {
      server = this.httpsServer;

      this.httpsServer.listen(this.config.port);
    } else {
      server = this.app.listen(this.config.port);
    }

    server.on('listening', () => {
      NxxSvcs.logger.info(`API service is listening on port ${this.config.port}`, NexxusApi.loggerLabel);
    });

    NexxusApi.instance = this;
  }

  private async loadApps(): Promise<void> {
    const results = await this.database.searchItems({ model: NexxusApplication.modelType });

    for (let app of results) {
      NexxusApi.loadedApps.set(app.getData().id, app as NexxusApplication);
    }

    NxxSvcs.logger.info(`Loaded ${NexxusApi.loadedApps.size} applications into API service`, NexxusApi.loggerLabel);
  }

  public static getStoredApp(appId: string): NexxusApplication | undefined {
    return NexxusApi.loadedApps.get(appId);
  }
}
