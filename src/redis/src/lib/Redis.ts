import {
  NEXXUS_PREFIX_LC,
  NexxusConfig,
  ConfigEnvVars,
  ConfigCliArgs,
  NexxusBaseService,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core'

import {
  NexxusDevice,
  NexxusDeviceProps
} from './models/Device';

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
        useReplicas: true
      });
    } else {
      this.client = await Redis.createClient({
        url: `redis://${this.config.host}:${this.config.port}`,
        username: this.config.user,
        password: this.config.password
      });
    }

    NxxSvcs.logger.info('Connected to redis', NexxusRedis.loggerLabel);
  }

  async saveDevice(device: NexxusDevice): Promise<void> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const key = device.getKey();
    const value = JSON.stringify({
      id: device.get('id'),
      applicationId: device.get('applicationId'),
      name: device.get('name'),
      type: device.get('type'),
      status: device.get('status'),
      lastSeen: (device.get('lastSeen') as Date).toISOString(),
      subscriptions: device.get('subscriptions') || []
    });

    await this.client.json.set(key, '$', value);
    NxxSvcs.logger.info(`Saved device "${device.get('id')}"`, NexxusRedis.loggerLabel);
  }

  async getDevice(deviceId: string): Promise<NexxusDevice | null> {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }

    const key = `${NEXXUS_PREFIX_LC}:device:${deviceId}`;
    const value = await this.client.json.get(key) as string | null;

    if (!value) {
      return null;
    }

    const parsed = JSON.parse(value);
    parsed.lastSeen = new Date(parsed.lastSeen);

    return new NexxusDevice(parsed as NexxusDeviceProps);
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      NxxSvcs.logger.info('Disconnected', NexxusRedis.loggerLabel);
    }
  }
}
