import {
  NexxusBaseLogger,
  INexxusBaseServices,
  NexxusBaseService,
  NexxusConfig,
  NexxusBaseModel,
  NexxusApplication,
  NexxusAppModel,
  NexxusModelTypeName,
  AnyNexxusModel,
  NexxusJsonPatch,
  NexxusFilterQuery
} from '@nexxus/core';

export type NexxusDatabaseAdapterEvents = {
  connect: [];
  disconnect: [];
  error: [Error];
}

export interface NexxusDbSearchOptions<T extends NexxusModelTypeName | string = string> {
  model: T;
  appId?: string;
  query?: NexxusFilterQuery;
  limit?: number;
  offset?: number;
}

export abstract class NexxusDatabaseAdapter<T extends NexxusConfig, Ev extends NexxusDatabaseAdapterEvents>
  extends NexxusBaseService<T, Ev extends NexxusDatabaseAdapterEvents ? Ev : NexxusDatabaseAdapterEvents> {

  public static logger: NexxusBaseLogger<any>;

  constructor(services: INexxusBaseServices) {
    super(services.configManager.getConfig('database') as T);

    if (!(services.logger instanceof NexxusBaseLogger)) {
      throw new Error("Logger service is not properly initialized in Database");
    }

    NexxusDatabaseAdapter.logger = services.logger;
  }

  protected static loggerLabel : Readonly<string> = "NxxDatabase";

  abstract connect(): Promise<void>;
  abstract reConnect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract createItems(collection: Array<AnyNexxusModel>): Promise<void>;
  abstract getItems(collection: Array<NexxusBaseModel>, query: any): Promise<Array<NexxusBaseModel>>;
  abstract searchItems(options: NexxusDbSearchOptions<'application'>): Promise<NexxusApplication[]>;
  abstract searchItems(options: NexxusDbSearchOptions<string>): Promise<NexxusAppModel[]>;
  abstract updateItems(collection: Array<NexxusJsonPatch>): Promise<void>;
  abstract deleteItems(collection: Array<NexxusBaseModel>): Promise<void>;

  protected abstract buildQuery(filter: NexxusFilterQuery): string | object;
}
