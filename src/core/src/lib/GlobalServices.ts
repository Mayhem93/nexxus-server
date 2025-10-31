import { BaseNexxusLogger } from "./Logger";
import { NexxusConfigManager } from "./ConfigManager";

type GlobalServicesInitParams = {
  logger?: BaseNexxusLogger;
  configManager?: NexxusConfigManager;
};

export class NexxusGlobalServices {
  static logger: Readonly<BaseNexxusLogger>;
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
