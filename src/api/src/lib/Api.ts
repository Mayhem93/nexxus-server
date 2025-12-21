import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusBaseService,
  INexxusBaseServices,
  NexxusBaseLogger,
  NexxusConfig,
  NexxusApplication,
  MODEL_REGISTRY,
  FatalErrorException
} from '@nexxus/core';
import {
  NexxusDatabaseAdapter,
  NexxusDatabaseAdapterEvents,
} from '@nexxus/database';
import {
  NexxusMessageQueueAdapter,
  NexxusMessageQueueAdapterEvents,
} from '@nexxus/message_queue';
import {
  NexxusRedis
} from '@nexxus/redis';
import {
  RootRoute,
  ApplicationRoute,
  DeviceRoute,
  SubscriptionRoute,
  ModelRoute
} from './routes';
import {
  NotFoundMiddleware,
  ErrorMiddleware,
  RequestLoggerMiddleware
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

interface ApiServices extends INexxusBaseServices {
  database: NexxusDatabaseAdapter<NexxusConfig, NexxusDatabaseAdapterEvents>;
  messageQueue: NexxusMessageQueueAdapter<NexxusConfig, NexxusMessageQueueAdapterEvents>;
  redis: NexxusRedis;
};

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
  public static logger : NexxusBaseLogger<any>;
  public static database : NexxusDatabaseAdapter<any, any>;
  public static messageQueue : NexxusMessageQueueAdapter<any, any>;
  public static redis : NexxusRedis;

  constructor(services: ApiServices) {
    super(services.configManager.getConfig('app') as NexxusApiConfig);

    if (!(services.logger instanceof NexxusBaseLogger)) {
      throw new FatalErrorException('Logger service is not an instance of NexxusBaseLogger');
    }
    if (!(services.database instanceof NexxusDatabaseAdapter)) {
      throw new FatalErrorException('Database service is not an instance of NexxusDatabaseAdapter');
    }
    if (!(services.messageQueue instanceof NexxusMessageQueueAdapter)) {
      throw new FatalErrorException('Message Queue service is not an instance of NexxusMessageQueueAdapter');
    }
    if (!(services.redis instanceof NexxusRedis)) {
      throw new FatalErrorException('Redis service is not an instance of NexxusRedis');
    }

    NexxusApi.logger = services.logger;
    NexxusApi.database = services.database;
    NexxusApi.messageQueue = services.messageQueue;
    NexxusApi.redis = services.redis;

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
    NexxusApi.logger.info('Initializing API service...', NexxusApi.loggerLabel);

    this.app.use(RequestLoggerMiddleware());
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

    new ApplicationRoute(this.app);
    new DeviceRoute(this.app);
    new SubscriptionRoute(this.app);
    new ModelRoute(this.app);

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
      NexxusApi.logger.info(`API service is listening on port ${this.config.port}`, NexxusApi.loggerLabel);
    });
  }

  private async loadApps(): Promise<void> {
    const results = await NexxusApi.database.searchItems({ model: MODEL_REGISTRY.application });

    for (let app of results) {
      NexxusApi.loadedApps.set(app.getData().id as string, app as NexxusApplication);
    }

    NexxusApi.logger.info(`Loaded ${NexxusApi.loadedApps.size} applications into API service`, NexxusApi.loggerLabel);
  }

  public static getStoredApp(appId: string): NexxusApplication | undefined {
    return NexxusApi.loadedApps.get(appId);
  }
}
