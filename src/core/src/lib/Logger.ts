import { ConfigEnvVars, ConfigCliArgs, AddJsonSchemaDefFuncArg } from './ConfigManager';

import * as Winston from 'winston';
import { JSONSchema7Definition } from 'json-schema';

import * as fs from 'fs';
import * as path from "node:path";

export enum NexxusLoggerLevels {
  EMERGENCY = "emerg",
  ALERT = "alert",
  CRITICAL = "crit",
  ERROR = "error",
  WARNING = "warn",
  NOTICE = "notice",
  INFO = "info",
  DEBUG = "debug"
}

export interface INexxusLogger {
  log(level: NexxusLoggerLevels, message: string): void
}

export interface INexxusAsyncLogger extends INexxusLogger {
  log(level: NexxusLoggerLevels, message: string): Promise<void>
}

export abstract class BaseNexxusLogger implements INexxusLogger {
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
      BaseNexxusLogger.schemaContents = fs.readFileSync(path.join(__dirname, this.schemaPath), 'utf-8');
    }

    return {
      name: "WinstonNexxusLogger",
      where: "logger",
      definition: JSON.parse(BaseNexxusLogger.schemaContents) as JSONSchema7Definition,
      required: true
    };
  }

  public abstract log(level: NexxusLoggerLevels, message: string): void

  public debug(message: string): void {
    this.log(NexxusLoggerLevels.DEBUG, message);
  }

  public info(message: string): void {
    this.log(NexxusLoggerLevels.INFO, message);
  }

  public warn(message: string): void {
    this.log(NexxusLoggerLevels.WARNING, message);
  }

  public error(message: string): void {
    this.log(NexxusLoggerLevels.ERROR, message);
  }

  public critical(message: string): void {
    this.log(NexxusLoggerLevels.CRITICAL, message);
  }

  public alert(message: string): void {
    this.log(NexxusLoggerLevels.ALERT, message);
  }

  public emerg(message: string): void {
    this.log(NexxusLoggerLevels.EMERGENCY, message);
  }
}

export class WinstonNexxusLogger extends BaseNexxusLogger {
  private config : { [key: string]: any } = {};
  private winston : Winston.Logger;
  protected static schemaPath: string = "../../src/schemas/winston-logger.schema.json";
  protected static envVars: ConfigEnvVars = {
    source: "WinstonNexxusLogger",
    specs: [
      {
        name: "LOG_LEVEL",
        location: "logger.level"
      }
    ]
  };
  protected static cliArgs: ConfigCliArgs = {
    source: "WinstonNexxusLogger",
    specs: []
  }

  constructor(config: Object) {
    super();

    this.config = config;

    let format : Winston.Logform.Format;

    if (this.config.logType === "json") {
      format = Winston.format.json();
    } else {
      format = Winston.format.printf(info => {
        return `[${info.timestamp}] ${info.level.toLocaleUpperCase()} [${info.label || "default-label"}]: ${info.message}`;
      });

      if (this.config.timestamps) {
        format = Winston.format.combine(
          Winston.format.timestamp(),
          format
        );
      }

      format = Winston.format.combine(
        Winston.format.label({ label: this.config.label }),
        format
      )

      if (this.config.colors) {
        format = Winston.format.combine(
          Winston.format.colorize(),
          format
        );
      }
    }

    this.winston = Winston.createLogger({
      level: this.config.level,
      format,
      transports: [
        new Winston.transports.Console()
      ]
    });
  }

  public log(level: NexxusLoggerLevels, message: string): void {
    this.winston.log(level, message);
  }
}
