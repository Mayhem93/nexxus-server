import { FatalErrorException } from "./Exceptions";

import * as fs from "fs";

import { ArgumentParser, SUPPRESS } from "argparse";

export type NexxusConfig = { [key: string]: unknown | NexxusConfig } | any;
export type CliArgType = "int" | "str" | "boolean" | "float";

export interface INexxusConfigProvider {
  getConfig(): Object | Promise<Object>
}

export abstract class NexxusConfigProvider implements INexxusConfigProvider {
  abstract getConfig(): NexxusConfig
}

export abstract class NexxusAsyncConfigProvider implements INexxusConfigProvider {
  abstract getConfig(): Promise<NexxusConfig>
}

export class NexxusFileConfigProvider extends NexxusConfigProvider {
  constructor(private filePath: string) {
    super();
  }

  public getConfig(): NexxusConfig {
    try {
      fs.accessSync(this.filePath);
    } catch (e) {
      throw new FatalErrorException(`Cannot access config file "${this.filePath}": ${e.message}`);
    }

    return JSON.parse(fs.readFileSync(this.filePath, 'utf-8')) as NexxusConfig;
  }
}

export class NexxusEnvVarsConfigProvider extends NexxusConfigProvider {
  static ENV_VAR_PREFIX : Readonly<string> = "NXX_";

  public getConfig(): NexxusConfig {
    const result : NexxusConfig = {};

    Object.keys(process.env).forEach(key => {
      if (key.startsWith(NexxusEnvVarsConfigProvider.ENV_VAR_PREFIX)) {
        result[key] = process.env[key] as string;
      }
    });

    return result;
  }
}

export class NexxusCliArgConfigProvider extends NexxusConfigProvider {
  private argParser: ArgumentParser;
  private originalExit: (status: number, message: string) => void;

  constructor() {
    super();

    this.argParser = new ArgumentParser({ add_help: false, usage: SUPPRESS });
    this.originalExit = this.argParser.exit.bind(this.argParser);
    this.argParser.exit = (status: number, message: string) => {
      if (message.search("unrecognized arguments: ") === -1) {
        this.originalExit(status, message);
      }
    }
  }

  public addArgument(name: string, type: CliArgType): void {
    this.argParser.add_argument(`--${name}`, { type: type, dest: name, required: false });
  }

  public getConfig(): NexxusConfig {
    return this.argParser.parse_args();
  }
}
