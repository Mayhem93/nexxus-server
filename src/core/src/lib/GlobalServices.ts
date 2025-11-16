import { BaseNexxusLogger } from "./Logger";
import { NexxusConfig } from "./ConfigProvider";
import { NexxusConfigManager } from "./ConfigManager";
import { NexxusException } from './Exceptions';

type GlobalServicesInitParams = {
  logger?: BaseNexxusLogger<NexxusConfig>;
  configManager?: NexxusConfigManager;
  database?: unknown;
  messageQueue?: unknown;
  redis?: unknown;
};

export class NexxusGlobalServices {
  static logger: Readonly<BaseNexxusLogger<NexxusConfig>>;
  static configManager: Readonly<NexxusConfigManager>;
  static database: unknown;
  static messageQueue: unknown;
  static redis: unknown;

  static init(params: GlobalServicesInitParams): void {
    if (params.logger !== undefined) {
      this.logger = params.logger;
    }
    if (params.configManager !== undefined) {
      this.configManager = params.configManager;
    }
    if (params.database !== undefined) {
      this.database = params.database;
    }
    if (params.messageQueue !== undefined) {
      this.messageQueue = params.messageQueue;
    }
    if (params.redis !== undefined) {
      this.redis = params.redis;
    }
  }
}
