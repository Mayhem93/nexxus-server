import {
  NexxusConfig,
  ConfigEnvVars,
  ConfigCliArgs,
  NexxusBaseService,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core'

import * as Redis from 'redis';

import * as path from 'node:path';

type NexxusRedisConfig = {
  host: string;
  port: number;
  user?: string;
  password?: string;
  cluster?: boolean;
} & NexxusConfig;

export class NexxusRedis extends NexxusBaseService<NexxusRedisConfig> {
  private client: Redis.RedisClientType | Redis.RedisClusterType | null = null;

  protected static loggerLabel: Readonly<string> = 'NxxRedis';
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/redis.schema.json");
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };

  constructor() {
    super(NxxSvcs.configManager.getConfig('redis') as NexxusRedisConfig);
  }

  public getClient(): Redis.RedisClientType | Redis.RedisClusterType {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    return this.client;
  }

  async init(): Promise<void> {
    if (this.config.cluster) {
      this.client = await Redis.createCluster({
        rootNodes: [
          {
            url: `redis://${this.config.host}:${this.config.port}`,
            username: this.config.user,
            password: this.config.password
          }
        ],
        useReplicas: true,
        RESP: 3,
        clientSideCache: {
          ttl: 5*60*1000, // 5 minutes
          maxEntries: 1000,
          evictPolicy: 'FIFO'
        }
      }) as unknown as Redis.RedisClusterType;
    } else {
      this.client = await Redis.createClient({
        url: `redis://${this.config.host}:${this.config.port}`,
        username: this.config.user,
        password: this.config.password,
        RESP: 3,
        clientSideCache: {
          ttl: 5 * 60 * 1000, // 5 minutes
          maxEntries: 1000,
          evictPolicy: 'FIFO'
        },
        socket: {
          keepAlive: true
        }
      }) as unknown as Redis.RedisClientType;
    }

    await this.client.connect();

    NxxSvcs.logger.info('Connected to redis', NexxusRedis.loggerLabel);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      NxxSvcs.logger.info('Disconnected', NexxusRedis.loggerLabel);
    }
  }
}
