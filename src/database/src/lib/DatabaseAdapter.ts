import { ConfigEnvVars, ConfigCliArgs, AddJsonSchemaDefFuncArg } from '@nexxus/core';
import { JSONSchema7Definition } from 'json-schema';
import { NexxusModel } from "../models/Model";

import * as fs from "node:fs";
import * as path from "node:path";
import { EventEmitter } from 'node:events';

export enum NexxusDatabaseAdapterEvents {
  CONNECTED = "connected",
  DISCONNECTED = "disconnected",
  ERROR = "error"
}

export abstract class NexxusDatabaseAdapter extends EventEmitter {
  protected config: any;

  protected static envVars: ConfigEnvVars;
  protected static cliArgs: ConfigCliArgs;
  protected static schemaPath: string;
  private static schemaContents: string;

  public static envVarConfig(): ConfigEnvVars {
    return this.envVars;
  }

  public static cliArgConfig(): ConfigCliArgs {
    return this.cliArgs;
  }

  public static schema(): AddJsonSchemaDefFuncArg {
    if (!this.schemaContents) {
      NexxusDatabaseAdapter.schemaContents = fs.readFileSync(path.join(__dirname, this.schemaPath), 'utf-8');
    }

    return {
      name: "NexxusDatabaseAdapter",
      where: "database",
      definition: JSON.parse(NexxusDatabaseAdapter.schemaContents) as JSONSchema7Definition,
      required: true
    };
  }

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
