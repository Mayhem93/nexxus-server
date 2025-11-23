import { NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import { NexxusBaseModel } from "../models/Model";

export type NexxusDatabaseAdapterEvents = {
  connect: [];
  disconnect: [];
  error: [Error];
}

export interface NexxusDbSearchOptions {
  model: 'application' | string;
  limit?: number;
  offset?: number;
};

export abstract class NexxusDatabaseAdapter<T extends NexxusConfig, Ev extends NexxusDatabaseAdapterEvents>
  extends NexxusBaseService<T, Ev extends NexxusDatabaseAdapterEvents ? Ev : NexxusDatabaseAdapterEvents> {

  constructor() {
    super(NxxSvcs.configManager.getConfig('database') as T);
  }

  protected static loggerLabel : Readonly<string> = "NxxDatabase";

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract createItems(collection: Array<NexxusBaseModel>): Promise<void>;
  abstract getItems(collection: Array<NexxusBaseModel>, query: any): Promise<Array<NexxusBaseModel>>;
  abstract searchItems(options: NexxusDbSearchOptions): Promise<Array<NexxusBaseModel>>;
  abstract updateItems(collection: Array<NexxusBaseModel>, query: any, updates: any): Promise<void>;
  abstract deleteItems(collection: Array<NexxusBaseModel>, query: any): Promise<void>;
}
