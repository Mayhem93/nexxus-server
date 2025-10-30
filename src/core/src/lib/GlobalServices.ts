import { BaseNexxusLogger } from "./Logger";
import { NexxusConfigManager } from "./ConfigManager";

type GlobalServicesInitParams = {
  logger: BaseNexxusLogger;
  configManager: NexxusConfigManager;
};

export class NexxusGlobalServices {
  static logger: Readonly<BaseNexxusLogger>;
  static configManager: Readonly<NexxusConfigManager>;

  static init(params: GlobalServicesInitParams): void {
    this.logger = params.logger;
    this.configManager = params.configManager;
  }
}
