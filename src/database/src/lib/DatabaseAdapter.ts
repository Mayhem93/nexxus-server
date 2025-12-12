import { NexxusBaseService,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs
} from '@nexxus/core';
import {
  NexxusBaseModel,
  NexxusApplication,
  NexxusAppModel,
  ModelTypeName,
  AnyNexxusModel
} from "@nexxus/core";

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

  abstract createItems(collection: Array<AnyNexxusModel>): Promise<void>;
  abstract getItems(collection: Array<NexxusBaseModel>, query: any): Promise<Array<NexxusBaseModel>>;
  abstract searchItems(options: NexxusDbSearchOptions<'application'>): Promise<NexxusApplication[]>;
  abstract searchItems(options: NexxusDbSearchOptions<string>): Promise<NexxusAppModel[]>;
  abstract updateItems(collection: Array<NexxusBaseModel>, query: any, updates: any): Promise<void>;
  abstract deleteItems(collection: Array<NexxusBaseModel>, query: any): Promise<void>;
}
