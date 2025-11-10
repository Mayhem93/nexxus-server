import { ConfigEnvVars, ConfigCliArgs, AddJsonSchemaDefFuncArg } from './ConfigManager';
import { FatalErrorException } from "./Exceptions";
import { NexxusConfig } from './ConfigProvider';

import { JSONSchema7 } from 'json-schema';

import * as fs from "node:fs";
import { EventEmitter } from 'node:events';

export type EventMap = Record<string | symbol, any[]>;

function frozen(target: any, propertyKey: string) {
  Object.defineProperty(target, propertyKey, {
    value: Object.freeze(target[propertyKey]),
    writable: false,
    configurable: false
  });
}

class TypedEventEmitter<E> {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
  }

  on<K extends keyof E>(event: K, listener: (...payload: E[K] extends any[] ? E[K] : never) => void): this {
    this.emitter.on(event as string | symbol, listener);
    return this;
  }

  once<K extends keyof E>(event: K, listener: (...payload: E[K] extends any[] ? E[K] : never) => void): this {
    this.emitter.once(event as string | symbol, listener);
    return this;
  }

  off<K extends keyof E>(event: K, listener: (...payload: E[K] extends any[] ? E[K] : never) => void): this {
    this.emitter.off(event as string | symbol, listener);
    return this;
  }

  emit<K extends keyof E>(event: K, ...payload: E[K] extends any[] ? E[K] : never): boolean {
    return this.emitter.emit(event as string | symbol, ...payload);
  }
}

export abstract class NexxusBaseService<T extends NexxusConfig, Ev extends EventMap = {}> extends TypedEventEmitter<Ev> {
  @frozen
  protected config: Readonly<T>;

  protected static envVars: ConfigEnvVars;
  protected static cliArgs: ConfigCliArgs;
  protected static schemaPath: string;
  private static schemaContents: string;

  constructor(config: Readonly<T>) {
    super();

    this.config = config;
  }

  public static envVarConfig(): ConfigEnvVars {
    if (!this.envVars) {
      throw new FatalErrorException(`Env vars spec not set for ${this.name} class.`);
    }

    return this.envVars;
  }

  public static cliArgConfig(): ConfigCliArgs {
    if (!this.cliArgs) {
      throw new FatalErrorException(`CLI args spec not set for ${this.name} class.`);
    }

    return this.cliArgs;
  }

  public static schema(): AddJsonSchemaDefFuncArg {
    if (!this.schemaPath) {
      throw new FatalErrorException(`Schema path not set for ${this.name} class.`);
    }

    if (!this.schemaContents) {
      this.schemaContents = fs.readFileSync(this.schemaPath, 'utf-8');
    }

    const definition: JSONSchema7 = JSON.parse(this.schemaContents);

    if (!definition.$comment) {
      throw new FatalErrorException(`Schema for ${this.name} is missing $comment field. ` +
        'This field is required to specify where in the main config this specific configuration ' +
        'should be placed.');
    }

    return {
      name: this.name,
      where: definition.$comment as string,
      definition,
      required: true
    };
  }
}
