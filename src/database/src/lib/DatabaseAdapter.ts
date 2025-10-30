import { NexxusBaseService } from '@nexxus/core';
import { NexxusModel } from "../models/Model";

export enum NexxusDatabaseAdapterEvents {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error"
}

export abstract class NexxusDatabaseAdapter extends NexxusBaseService {
  protected static loggerLabel : Readonly<string> = "NxxDatabase";
  constructor(config: any) {
    super();

    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract createItems(collection: Array<NexxusModel>): Promise<void>;
  abstract getItems(collection: Array<NexxusModel>, query: any): Promise<Array<NexxusModel>>;
  abstract updateItems(collection: Array<NexxusModel>, query: any, updates: any): Promise<void>;
  abstract deleteItems(collection: Array<NexxusModel>, query: any): Promise<void>;
}
