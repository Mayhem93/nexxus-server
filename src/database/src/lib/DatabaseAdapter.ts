import { NexxusBaseService, NexxusConfig } from '@nexxus/core';
import { NexxusBaseModel } from "../models/Model";

export enum NexxusDatabaseAdapterEvents {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error"
}

export abstract class NexxusDatabaseAdapter<T extends NexxusConfig> extends NexxusBaseService<T> {
  protected static loggerLabel : Readonly<string> = "NxxDatabase";
  constructor(config: T) {
    super(config);
  }

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract createItems(collection: Array<NexxusBaseModel>): Promise<void>;
  abstract getItems(collection: Array<NexxusBaseModel>, query: any): Promise<Array<NexxusBaseModel>>;
  abstract updateItems(collection: Array<NexxusBaseModel>, query: any, updates: any): Promise<void>;
  abstract deleteItems(collection: Array<NexxusBaseModel>, query: any): Promise<void>;
}
