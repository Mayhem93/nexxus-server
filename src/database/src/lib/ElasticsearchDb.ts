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
  NexxusApplicationUser,
  NexxusUserModelType,
  NexxusJsonPatch,
  NexxusFilterQuery,
  NexxusLogicalOperator,
  ConnectionException,
  NEXXUS_PREFIX_LC
} from "@nexxus/core";

import * as ElasticSearch from '@elastic/elasticsearch';
import type {
  BulkOperationBase,
  BulkOperationContainer,
  BulkUpdateAction,
  QueryDslQueryContainer,
  QueryDslBoolQuery
} from "@elastic/elasticsearch/lib/api/typesWithBodyKey";

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

type ESBulkRequest = {
  body: Array<BulkOperationBase | BulkOperationContainer | INexxusBaseModel>;
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

      switch (item.constructor) {
        case NexxusApplication:
          itemData = item.getData();
          index = `${NEXXUS_PREFIX_LC}-applications`;

          break;
        case NexxusApplicationUser:
          itemData = (item as NexxusApplicationUser).getData();
          index = `${NEXXUS_PREFIX_LC}-app-${itemData.appId}-users`;

          break;
        case NexxusAppModel:
          itemData = (item as NexxusAppModel).getData();
          index = `${NEXXUS_PREFIX_LC}-app-${itemData.appId}-${itemData.type}`;

          break;
        default:
          throw new Error(`ElasticsearchDb.createItems: Unsupported model type: ${(item as NexxusBaseModel).getData().type}`);
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
  async searchItems(options: NexxusDbSearchOptions<'user'>): Promise<NexxusApplicationUser[]>;
  async searchItems(options: NexxusDbSearchOptions<string>): Promise<NexxusAppModel[]>;

  async searchItems(options: NexxusDbSearchOptions<string>): Promise<Array<AnyNexxusModel>> {
    let index = NEXXUS_PREFIX_LC;

    switch (options.type) {
      case 'application':
        index += '-applications';

        break;

      case 'user':
        if (!options.appId) {
          throw new Error("App ID is required for searching user models");
        }

        index += `-app-${options.appId}-users`;

        break;
      default:
        if (!options.appId) {
          throw new Error("App ID is required for searching app-specific models");
        }

        const modelName = options.type;

        index += `-app-${options.appId}-${modelName}`;
    }

    const esSearchRequest: ElasticSearch.estypes.SearchRequest = {
      index: index,
      from: options.offset || 0,
      size: options.limit || 100,
      query: this.buildQuery(options.filter)
    };

    NexxusElasticsearchDb.logger.debug(`Executing Elasticsearch search with request: ${JSON.stringify(esSearchRequest)}`, NexxusDatabaseAdapter.loggerLabel);

    const searchResults = await this.client.search(esSearchRequest);

    const models: Array<AnyNexxusModel> = searchResults.hits.hits.map(res => {
      switch (options.type) {
        case 'application':
          return new NexxusApplication(res._source as NexxusApplicationModelType);

        case 'user':
          return new NexxusApplicationUser(res._source as NexxusUserModelType);

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

  async updateItems(collection: Array<NexxusJsonPatch>): Promise<void> {
    const bulkBody: Array<BulkOperationContainer | BulkUpdateAction> = [];

    for (const patch of collection) {
      const patchData = patch.get();
      const index = `${NEXXUS_PREFIX_LC}-app-${patchData.metadata.appId}-${patchData.metadata.type}`

      // Build a single script for all paths in this patch
      const scriptLines = patchData.path.map((path, idx) => {
        switch (patchData.op) {
          case 'replace':
            return `ctx._source.${path} = params.value${idx}`;
          default:
            NexxusElasticsearchDb.logger.warn(`Unsupported JSON Patch operation: ${patchData.op}`, NexxusDatabaseAdapter.loggerLabel);
        }
      });

      const scriptParams = patchData.path.reduce((acc, path, idx) => {
        acc[`value${idx}`] = patchData.value[idx];

        return acc;
      }, {} as Record<string, any>);

      bulkBody.push(
        { update: { _index: index, _id: patchData.metadata.id } },
        {
          script: {
            source: scriptLines.join(';\n'),
            lang: 'painless',
            params: scriptParams
          }
        }
      );
    }

    if (bulkBody.length === 0) {
      NexxusElasticsearchDb.logger.warn("No items to update in Elasticsearch database", NexxusDatabaseAdapter.loggerLabel);
    } else {
      await this.client.bulk({ operations: bulkBody });
    }
  }

  async deleteItems(collection: Array<NexxusBaseModel>): Promise<void> {
    const bulkBody : Array<BulkOperationContainer> = [];

    for (const item of collection) {
      let index;
      let itemData;

      if (item instanceof NexxusApplication) {
        itemData = item.getData();
        index = `${NEXXUS_PREFIX_LC}-applications`;
      } else {
        itemData = (item as NexxusAppModel).getData();
        index = `${NEXXUS_PREFIX_LC}-app-${itemData.appId}-${itemData.type}`;
      }

      bulkBody.push(
        { delete: { _index: index, _id: itemData.id as string } }
      );
    }

    await this.client.bulk({ operations: bulkBody });
  }

  protected buildQuery(filter?: NexxusFilterQuery): QueryDslQueryContainer {
    if (filter === undefined) {
      return { match_all: {} };
    }

    const root: QueryDslQueryContainer = { bool: { must: [] } };
    const stack: Array<{ depth: number; boolQuery: any; operator: NexxusLogicalOperator }> = [];

    let currentBool = root.bool as QueryDslBoolQuery;
    let currentOperator: NexxusLogicalOperator = '$and'; // Root is always AND

    for (const node of filter) {
      // Handle depth changes (pop stack when going back up)
      while (stack.length > 0 && stack[stack.length - 1].depth >= node.depth) {
        stack.pop();
      }

      // Update current context from stack
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];

        currentBool = parent.boolQuery;
        currentOperator = parent.operator;
      } else {
        currentBool = root.bool as QueryDslBoolQuery;
        currentOperator = '$and';
      }

      if (node.type === 'logical') {
        // Create new bool query for logical operator
        const newBool : QueryDslQueryContainer = { bool: {} };

        if (node.operator === '$or') {
          newBool!.bool!.should = [];
          newBool!.bool!.minimum_should_match = 1;
        } else {
          newBool!.bool!.must = [];
        }

        // Add to current parent
        if (currentOperator === '$or') {
          (currentBool!.should as QueryDslQueryContainer[]).push(newBool);
        } else {
          (currentBool!.must as QueryDslQueryContainer[]).push(newBool);
        }

        // Push to stack
        stack.push({ depth: node.depth, boolQuery: newBool.bool, operator: node.operator });

      } else if (node.type === 'field') {
        // Build field query
        let fieldQuery: any;

        if (node.operator === 'eq') {
          fieldQuery = { term: { [`${node.field}.keyword`]: node.value } };
        } else if (node.operator === 'in') {
          fieldQuery = { terms: { [`${node.field}.keyword`]: node.value } };
        } else if (node.operator === 'ne') {
          fieldQuery = { bool: { must_not: { term: { [`${node.field}.keyword`]: node.value } } } };
        } else {
          // Range operators (gte, lte, gt, lt) - NO CHANGE HERE
          fieldQuery = { range: { [node.field]: { [node.operator]: node.value } } };
        }

        // Add to current bool based on parent operator
        if (currentOperator === '$or') {
          if (!currentBool.should) currentBool.should = [];
          (currentBool!.should as QueryDslQueryContainer[]).push(fieldQuery);
        } else {
          if (!currentBool.must) currentBool.must = [];
          (currentBool!.must as QueryDslQueryContainer[]).push(fieldQuery);
        }
      }
    }

    NexxusDatabaseAdapter.logger.debug(`Built Elasticsearch query: ${JSON.stringify(root)}`, NexxusDatabaseAdapter.loggerLabel);

    return root;
  }
}
