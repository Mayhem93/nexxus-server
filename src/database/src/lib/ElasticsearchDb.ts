import {
  NexxusDatabaseAdapter,
  NexxusDatabaseAdapterEvents,
  NexxusDbSearchOptions
} from "./DatabaseAdapter";
import {
  NexxusConfig,
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusBaseModel,
  INexxusBaseServices,
  type INexxusBaseModel,
  type AnyNexxusModel,
  type AnyNexxusModelType,
  NexxusApplication,
  NexxusApplicationModelType,
  NexxusAppModel,
  NexxusAppModelType,
  ConnectionException,
  NEXXUS_PREFIX_LC
} from "@nexxus/core";

import * as ElasticSearch from '@elastic/elasticsearch';

import * as path from "node:path";

type ElasticsearchConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
} & NexxusConfig;

export type ElasticSearchEvents = NexxusDatabaseAdapterEvents & {
  something: [string];
}

type ESBulkItemHeader = {
  index: {
    _id: string;
    _index: string;
  }
};

type ESBulkRequest = {
  body: Array<ESBulkItemHeader | INexxusBaseModel>;
}

export class NexxusElasticsearchDb extends NexxusDatabaseAdapter<ElasticsearchConfig, ElasticSearchEvents> {
  private client: ElasticSearch.Client;
  private collectedIndices: Set<string> = new Set();

  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/elasticsearch.schema.json");
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: [
      {
        name: "DB_HOST",
        location: "database.host"
      },
      {
        name: "DB_PORT",
        location: "database.port"
      },
      {
        name: "DB_USERNAME",
        location: "database.user"
      },
      {
        name: "DB_PASSWORD",
        location: "database.password"
      }
    ]
  };
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };

  constructor(services: INexxusBaseServices) {
    super(services);

    this.client = new ElasticSearch.Client({
      node: `http://${this.config.host}:${this.config.port}`,
      auth: {
        username: this.config.user,
        password: this.config.password
      }
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping({}, { requestTimeout: 2000, maxRetries: 5});

      NexxusElasticsearchDb.logger.debug("Connection established with Elasticsearch database", NexxusDatabaseAdapter.loggerLabel);

      const indices: ElasticSearch.estypes.CatIndicesResponse = await this.client.cat.indices({
        format: "json",
        h: ["index"],
        index: `${NEXXUS_PREFIX_LC}-*`,
        expand_wildcards: "open"
      });

      NexxusElasticsearchDb.logger.debug(`Found ${indices.length} indices in Elasticsearch database`, NexxusDatabaseAdapter.loggerLabel);

      indices.forEach(indexInfo => {
        this.collectedIndices.add(indexInfo.index as string);
      });

    } catch (e : Error | unknown) {
      if (e instanceof ElasticSearch.errors.ConnectionError) {
        throw new ConnectionException("Failed to connect to Elasticsearch database");
      } else {
        throw e;
      }
    }
  }

  async reConnect(): Promise<void> {
    // TODO: Implement reconnection logic if needed
  }

  async disconnect(): Promise<void> {
    return this.client.close();
  }

  private async createIndexIfNotExists(indexName: string): Promise<void> {
    if (!this.collectedIndices.has(indexName)) {
      NexxusElasticsearchDb.logger.debug(`Creating index ${indexName} in Elasticsearch database`, NexxusDatabaseAdapter.loggerLabel);

      await this.client.indices.create({ index: indexName });

      NexxusElasticsearchDb.logger.debug(`Index ${indexName} created in Elasticsearch database`, NexxusDatabaseAdapter.loggerLabel);
      this.collectedIndices.add(indexName);
    }
  }

  async createItems(collection: Array<AnyNexxusModel>): Promise<void> {
    const bulkReq : ESBulkRequest = { body: [] };

    for (const item of collection) {
      let itemData : AnyNexxusModelType;
      let index;

      if (item instanceof NexxusApplication) {
        itemData = item.getData();
        index = `${NEXXUS_PREFIX_LC}-applications`;
      } else {
        itemData = (item as NexxusAppModel).getData();
        index = `${NEXXUS_PREFIX_LC}-app-${itemData.appId}-${itemData.type}`;
      }

      await this.createIndexIfNotExists(index);

      bulkReq.body.push(
        { index: { _index: index, _id: itemData.id as string } },
        itemData
      );
    }

    await this.client.bulk(bulkReq);
  }

  async searchItems(options: NexxusDbSearchOptions<'application'>): Promise<NexxusApplication[]>;
  async searchItems(options: NexxusDbSearchOptions<string>): Promise<NexxusAppModel[]>;

  async searchItems(options: NexxusDbSearchOptions<string>): Promise<Array<AnyNexxusModel>> {
    let index = NEXXUS_PREFIX_LC;

    if (options.model === 'application') {
      index += '-applications';
    } else {
      const modelName = options.model;

      index += `-app-${options.query.appId}-${modelName}`;
    }

    const searchResults = await this.client.search({
      index: index,
      from: options.offset || 0,
      size: options.limit || 100,
      query: {
        match_all: {}
      }
    });

    const models: Array<AnyNexxusModel> = searchResults.hits.hits.map(res => {
      //TODO: update this when implementing the application model class properly
      switch (options.model) {
        case 'application':
          return new NexxusApplication(res._source as NexxusApplicationModelType);

        default:
          return new NexxusAppModel(res._source as NexxusAppModelType);
      }
    });

    return models;
  }

  async getItems(collection: Array<NexxusBaseModel>, query: any): Promise<Array<NexxusBaseModel>> {
    // Implementation for retrieving items from Elasticsearch
    return [];
  }

  async updateItems(collection: Array<NexxusBaseModel>, query: any, updates: any): Promise<void> {
    // Implementation for updating items in Elasticsearch
  }

  async deleteItems(collection: Array<NexxusBaseModel>, query: any): Promise<void> {
    // Implementation for deleting items from Elasticsearch
  }
}
