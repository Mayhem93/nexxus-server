import { ConfigEnvVars, ConfigCliArgs, AddJsonSchemaDefFuncArg } from './ConfigManager';
import { FatalErrorException } from "./Exceptions";

import { JSONSchema7 } from 'json-schema';

import * as fs from "node:fs";
import { EventEmitter } from 'node:events';
import { NexxusConfig } from './ConfigProvider';

export abstract class NexxusBaseService extends EventEmitter {
  protected config: NexxusConfig;

  protected static envVars: ConfigEnvVars;
  protected static cliArgs: ConfigCliArgs;
  protected static schemaPath: string;
  private static schemaContents: string;

  constructor(config: NexxusConfig) {
    super();

    this.config = config;
  }

  public static envVarConfig(): ConfigEnvVars {
      return this.envVars;
    }

  public static cliArgConfig(): ConfigCliArgs {
    return this.cliArgs;
  }

  public static schema(): AddJsonSchemaDefFuncArg {
    if (!this.schemaContents) {
      this.schemaContents = fs.readFileSync(this.schemaPath, 'utf-8');
    }

    const definition: JSONSchema7 = JSON.parse(this.schemaContents);

    if (!definition.$comment) {
      throw new FatalErrorException(`Schema for ${this.name} is missing $comment field. ` +
        "This field is required to specify where in the configuration this schema should be applied.");
    }

    return {
      name: this.name,
      where: definition.$comment as string,
      definition,
      required: true
    };
  }
}
