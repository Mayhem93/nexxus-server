import { NexxusBaseModel } from "../models/Model";
import { NexxusApplication } from "../models/Application";
import { NexxusDatabaseAdapter } from "./DatabaseAdapter";
import {
  NexxusGlobalServices as NxxSvcs,
  ConfigCliArgs,
  ConfigEnvVars,
  ConnectionException,
  NEXXUS_PREFIX_LC
} from "@nexxus/core";

import * as ElasticSearch from '@elastic/elasticsearch';

import * as path from "node:path";

interface ElasticsearchConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

type ESBulkItemHeader = {
  index: {
    _id: string;
    _index: string;
  }
};

type ESBulkRequest = {
  body: Array<ESBulkItemHeader | NexxusBaseModel>;
}

export class NexxusElasticsearchDb extends NexxusDatabaseAdapter {
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
        location: "database.username"
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

  constructor(config: ElasticsearchConfig) {
    super(config);

    this.client = new ElasticSearch.Client({
      node: `http://${config.host}:${config.port}`,
      auth: {
        username: this.config.username,
        password: this.config.password
      }
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.ping({}, { requestTimeout: 2000, maxRetries: 5});

      NxxSvcs.logger.debug("Connection established with Elasticsearch database", NexxusDatabaseAdapter.loggerLabel);

      const indices: ElasticSearch.estypes.CatIndicesResponse = await this.client.cat.indices({
        format: "json",
        h: ["index"],
        index: `${NEXXUS_PREFIX_LC}-*`,
        expand_wildcards: "open"
      });

      NxxSvcs.logger.debug(`Found ${indices.length} indices in Elasticsearch database`, NexxusDatabaseAdapter.loggerLabel);

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
      NxxSvcs.logger.debug(`Creating index ${indexName} in Elasticsearch database`, NexxusDatabaseAdapter.loggerLabel);

      await this.client.indices.create({ index: indexName });

      NxxSvcs.logger.debug(`Index ${indexName} created in Elasticsearch database`, NexxusDatabaseAdapter.loggerLabel);

      this.collectedIndices.add(indexName);
    }
  }

  async createItems(collection: Array<NexxusBaseModel>): Promise<void> {
    const bulkReq : ESBulkRequest = { body: [] };

    for (const item of collection) {
      const itemData = item.getData();
      let index: string;

      if (item instanceof NexxusApplication) {
        index = `${NEXXUS_PREFIX_LC}-applications`;
      } else {
        index = `${NEXXUS_PREFIX_LC}-default`;
      }

      await this.createIndexIfNotExists(index);

      bulkReq.body.push(
        { index: { _index: index, _id: itemData.id } },
        item
      );
    }

    await this.client.bulk(bulkReq);
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
