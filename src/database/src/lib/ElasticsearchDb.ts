import { NexxusModel } from "../models/Model";
import { NexxusDatabaseAdapter } from "./DatabaseAdapter";
import { ConfigCliArgs, ConfigEnvVars, ConnectionException } from "@nexxus/core";

import * as ElasticSearch from '@elastic/elasticsearch'; // Assuming an Elasticsearch client library is used

interface ElasticsearchConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export class NexxusElasticsearchDb extends NexxusDatabaseAdapter {
  private client: ElasticSearch.Client;

  protected static schemaPath: string = "../../src/schemas/elasticsearch.schema.json";
  protected static envVars: ConfigEnvVars = {
    source: "NexxusElasticsearchDb",
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
    source: "NexxusElasticsearchDb",
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
    } catch (e) {
      throw new ConnectionException("Failed to connect to Elasticsearch database");
    }
  }

  async reConnect(): Promise<void> {
    // TODO: Implement reconnection logic if needed
  }

  async disconnect(): Promise<void> {
    return this.client.close();
  }

  async createItems(collection: Array<NexxusModel>): Promise<void> {
    // Implementation for creating items in Elasticsearch
  }

  async getItems(collection: Array<NexxusModel>, query: any): Promise<Array<NexxusModel>> {
    // Implementation for retrieving items from Elasticsearch
    return [];
  }

  async updateItems(collection: Array<NexxusModel>, query: any, updates: any): Promise<void> {
    // Implementation for updating items in Elasticsearch
  }

  async deleteItems(collection: Array<NexxusModel>, query: any): Promise<void> {
    // Implementation for deleting items from Elasticsearch
  }
}
