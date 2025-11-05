import { BaseNexxusLogger } from "./Logger";
import { NexxusConfig } from "./ConfigProvider";
import { NexxusConfigManager } from "./ConfigManager";
import { NexxusException } from './Exceptions';

type GlobalServicesInitParams = {
  logger?: BaseNexxusLogger<NexxusConfig>;
  configManager?: NexxusConfigManager;
};

export class NexxusGlobalServices {
  static logger: Readonly<BaseNexxusLogger<NexxusConfig>>;
  static configManager: Readonly<NexxusConfigManager>;

  static init(params: GlobalServicesInitParams): void {
    if (params.logger !== undefined) {
      this.logger = params.logger;
    }
    if (params.configManager !== undefined) {
      this.configManager = params.configManager;
    }
  }
}
