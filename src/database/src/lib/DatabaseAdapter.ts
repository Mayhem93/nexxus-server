import { NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import {
  INexxusBaseModel,
  ModelTypeName,
  type AnyNexxusModel
} from "../models/BaseModel";

export type NexxusDatabaseAdapterEvents = {
  connect: [];
  disconnect: [];
  error: [Error];
}

export interface NexxusDbSearchOptions<T extends ModelTypeName | string = string> {
  model: T;
  query: any;
  limit?: number;
  offset?: number;
}

export abstract class NexxusDatabaseAdapter<T extends NexxusConfig, Ev extends NexxusDatabaseAdapterEvents>
  extends NexxusBaseService<T, Ev extends NexxusDatabaseAdapterEvents ? Ev : NexxusDatabaseAdapterEvents> {

  constructor() {
    super(NxxSvcs.configManager.getConfig('database') as T);
  }

  protected static loggerLabel : Readonly<string> = "NxxDatabase";

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract createItems(collection: Array<INexxusBaseModel>): Promise<void>;
  abstract getItems(collection: Array<INexxusBaseModel>, query: any): Promise<Array<INexxusBaseModel>>;
  abstract searchItems(options: NexxusDbSearchOptions<string>): Promise<Array<AnyNexxusModel>>;
  abstract updateItems(collection: Array<INexxusBaseModel>, query: any, updates: any): Promise<void>;
  abstract deleteItems(collection: Array<INexxusBaseModel>, query: any): Promise<void>;
}
