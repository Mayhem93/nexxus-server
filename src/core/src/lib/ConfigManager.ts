import { InvalidConfigException } from "./Exceptions";
import {
  CliArgType,
  NexxusConfig,
  INexxusConfigProvider,
  NexxusFileConfigProvider,
  NexxusEnvVarsConfigProvider,
  NexxusCliArgConfigProvider
} from "./ConfigProvider";

import { Ajv, ErrorObject } from "ajv";
import * as Dot from "dot-prop";
import deepMerge from "deepmerge";
import type { JSONSchema7 } from "json-schema";

import * as fs from "node:fs";
import * as path from "node:path";

type JsonSchema = JSONSchema7;
type ConfigErrorObject = ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;

type EnvVarsSpec = {
  name: string;
  location: string;
};

type EnvVars = {
  source: string;
  spec: Array<EnvVarsSpec>;
};

type CliArgsSpec = {
  name: string;
  location: string;
  type: CliArgType;
}

type CliArgs = {
  source: string;
  spec: Array<CliArgsSpec>;
};

export class ConfigurationManager {
  private static CONF_FILE_NAME : Readonly<string> = "nexxus.conf.json";

  private jsonSchema: JsonSchema;
  private validationErrors: ConfigErrorObject;
  private envVarsSpecs: Array<EnvVars> = [];
  private cliArgsSpecs: Array<CliArgs> = [];
  private data: NexxusConfig = {};

  private defaultProviders : Array<INexxusConfigProvider> = [];
  private customProviders : Array<INexxusConfigProvider> = [];

  constructor() {
    const schemaPath = path.join(__dirname, "../../src/schemas/root.schema.json");

    this.jsonSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

    this.defaultProviders.push(new NexxusFileConfigProvider(path.join(process.cwd(), ConfigurationManager.CONF_FILE_NAME)));
    this.defaultProviders.push(new NexxusEnvVarsConfigProvider());
    this.defaultProviders.push(new NexxusCliArgConfigProvider());
  }

  public addCustomProvider(provider: INexxusConfigProvider): void {
    this.defaultProviders.splice(1, 0, provider);
  }

  public addDatabaseSchemaModel(jsonSchema: string): void {
    if (this.jsonSchema?.$defs?.NexxusDatabase) {
      throw new InvalidConfigException("Database schema already defined");
    }

    //TODO: validate that jsonSchema is a valid json schema; eg try to ajv compile it

    if (this.jsonSchema.$defs !== undefined) {
      this.jsonSchema.$defs.NexxusDatabase = JSON.parse(jsonSchema);
    }

    if (this.jsonSchema.properties !== undefined) {
      this.jsonSchema.properties.database = { "$ref": "#/$defs/NexxusDatabase" };
    }
  }

  public addCliArgsToSpec(source: string, spec: Array<CliArgsSpec>): void {
    this.cliArgsSpecs.push({ source, spec });
  }

  public addEnvVarsToSpec(source: string, spec: Array<EnvVarsSpec>): void {
    this.envVarsSpecs.push({ source, spec });
  }

  private populateFromCliArgs(): void {
    if (this.cliArgsSpecs.length === 0) {
      return;
    }

    const collectedNames : Map<string, string> = new Map();
    const cliArgProvider = this.defaultProviders.at(-1) as NexxusCliArgConfigProvider;

    this.cliArgsSpecs.forEach(spec => {
      spec.spec.forEach((arg) => {
        if (collectedNames.has(arg.name)) {
          throw new InvalidConfigException(`Duplicate CLI argument name: "${arg.name}". Defined first by source: "${collectedNames.get(arg.name)}" and now by source: "${spec.source}"`);
        }

        collectedNames.set(arg.name, spec.source);

        cliArgProvider.addArgument(arg.name, arg.type);
      });
    });

    const parsed = cliArgProvider.getConfig();

    this.cliArgsSpecs.forEach(spec => {
      spec.spec.forEach(arg => {
        if (parsed[arg.name] !== undefined && parsed[arg.name] !== null) {
          Dot.setProperty(this.data, arg.location, parsed[arg.name]);
        }
      });
    });
  }

  private populateFromEnvVars(): void {
    if (this.envVarsSpecs.length === 0) {
      return;
    }

    const collectedNames: Map<string, string> = new Map();
    const envVarProvider = this.defaultProviders.at(-2) as NexxusEnvVarsConfigProvider;
    const envResult = envVarProvider.getConfig();

    this.envVarsSpecs.forEach(spec => {
      spec.spec.forEach(envVar => {
        if (collectedNames.has(envVar.name)) {
          throw new InvalidConfigException(`Duplicate Env var: "${envVar.name}". Defined first by source: "${collectedNames.get(envVar.name)}" and now by source: "${spec.source}"`);
        }

        const value = envResult[envVar.name];

        if (value !== undefined) {
          Dot.setProperty(this.data, envVar.location, value);
        }

        collectedNames.set(envVar.name, spec.source);
      });
    });
  }

  public isValid() : boolean {
    const fileConfigProvider = this.defaultProviders.at(0) as NexxusFileConfigProvider;

    this.data = fileConfigProvider.getConfig();

    // TODO: handle custom config providers
    if (this.customProviders.length > 0) {
      // getConfig() here and then do deep merge
      // this.data = deepMerge(this.data, result);
    }

    if (this.cliArgsSpecs.length > 0) {
      this.populateFromCliArgs();
    }

    if (this.envVarsSpecs.length > 0) {
      this.populateFromEnvVars();
    }

    const ajv = new Ajv();
    const validator = ajv.compile(this.jsonSchema);
    const result : boolean = validator(this.data);

    if (!result) {
      this.validationErrors = validator.errors;

      return false;
    }

    // this.data = combinedData;

    return true;
  }

  public getErrors(): ConfigErrorObject {
    return this.validationErrors;
  }

  public getConfig(): NexxusConfig {
    return this.data;
  }
}
