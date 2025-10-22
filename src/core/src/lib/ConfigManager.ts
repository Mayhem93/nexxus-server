import { InvalidConfigException } from "./Exceptions";

import { Ajv, ValidateFunction, ErrorObject } from "ajv";
import * as Dot from "dot-prop";
import { ArgumentParser } from "argparse";
import deepMerge from "deepmerge";

import * as fs from "node:fs";
import * as path from "node:path";

type ConfigErrorObject = ErrorObject<string, Record<string, any>, unknown>[] | null | undefined;
type JsonSchema = {
  [key: string]: any
}

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
  type: "int" | "str" | "boolean" | "float";
}

type CliArgs = {
  source: string;
  spec: Array<CliArgsSpec>;
};

type ConfigConstructorInput = {
  jsonSchema: string;
  envVarsSpec?: Array<EnvVars> | [];
  cliArgsSpec?: Array<CliArgs> | [];
}

export class ConfigurationManager {
  private jsonSchema: JsonSchema = {};
  private validationErrors: ConfigErrorObject;
  private argParser: ArgumentParser;
  private envVarsSpecs: Array<EnvVars> = [];
  private cliArgsSpecs: Array<CliArgs> = [];
  private data: Object = {};

  constructor() {
    const schemaPath = path.join(
      __dirname,
      "../../src/schemas/root.schema.json"
    );

    this.jsonSchema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    this.argParser = new ArgumentParser({ add_help: false });

    /* const ajv = new Ajv();

    this.schemaValidator = ajv.compile(this.jsonSchema);
    this.envVarsSpecs = input.envVarsSpec;
    this.cliArgsSpecs = input.cliArgsSpec;

    if (this.cliArgsSpecs?.spec && this.cliArgsSpecs.spec?.length > 0) {
      this.argParser = new ArgumentParser({ add_help: false });
    } */
  }

  public addDatabaseSchemaModel(jsonSchema: string): void {
    if (this.jsonSchema.$defs.NexxusDatabase) {
      throw new InvalidConfigException("Database schema already defined");
    }

    this.jsonSchema.$defs.NexxusDatabase = JSON.parse(jsonSchema);
    this.jsonSchema.properties.database.$ref = "#/$defs/NexxusDatabase";
  }

  /* private appendJsonSchema(jsonSchema: string): void {
    this.schemaValidator = this.schemaValidator || new Ajv();
    this.schemaValidator = this.schemaValidator.compile(JSON.parse(jsonSchema));
  } */

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

    this.cliArgsSpecs.forEach(spec => {
      spec.spec.forEach((arg) => {
        if (collectedNames.has(arg.name)) {
          throw new InvalidConfigException(`Duplicate CLI argument name: "${arg.name}". Defined first by source: "${collectedNames.get(arg.name)}" and now by source: "${spec.source}"`);
        }

        collectedNames.set(arg.name, spec.source);
        this.argParser?.add_argument(`--${arg.name}`, { type: arg.type, dest: arg.name, required: false });
      });
    });

    const parsed = this.argParser.parse_args();

    this.cliArgsSpecs.forEach(spec => {
      spec.spec.forEach(arg => {
        if (parsed[arg.name] !== undefined && parsed[arg.name] !== null) {
          console.log(`Setting ${arg.name} to ${parsed[arg.name]}`);
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

    this.envVarsSpecs.forEach(spec => {
      spec.spec.forEach(envVar => {
        if (collectedNames.has(envVar.name)) {
          throw new InvalidConfigException(`Duplicate Env var: "${envVar.name}". Defined first by source: "${collectedNames.get(envVar.name)}" and now by source: "${spec.source}"`);
        }

        const value = process.env[envVar.name];

        if (value !== undefined) {
          Dot.setProperty(this.data, envVar.location, value);
        }

        collectedNames.set(envVar.name, spec.source);
      });
    });
  }

  public isValid(data: Object) : boolean {
    if (this.cliArgsSpecs.length > 0) {
      this.populateFromCliArgs();
    }

    if (this.envVarsSpecs.length > 0) {
      this.populateFromEnvVars();
    }

    const ajv = new Ajv();
    const validator = ajv.compile(this.jsonSchema);
    const combinedData : Object = deepMerge(data, this.data);
    const result : boolean = validator(combinedData);

    if (!result) {
      this.validationErrors = validator.errors;

      return false;
    }

    this.data = combinedData;

    return true;
  }

  public getErrors(): ConfigErrorObject {
    return this.validationErrors;
  }

  public getConfig(): Object {
    return this.data;
  }
}
