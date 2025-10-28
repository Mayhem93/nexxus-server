import { ConfigEnvVars, ConfigCliArgs, AddJsonSchemaDefFuncArg } from './ConfigManager';

import * as Winston from 'winston';

import * as path from "node:path";
import { NexxusBaseService } from './BaseService';

type LoggableType = string | object | number | boolean | null | undefined;

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
  log(level: NexxusLoggerLevels, message: LoggableType): void
}

export interface INexxusAsyncLogger extends INexxusLogger {
  log(level: NexxusLoggerLevels, message: LoggableType): Promise<void>
}

export abstract class BaseNexxusLogger extends NexxusBaseService implements INexxusLogger {

  public abstract log(level: NexxusLoggerLevels, message: LoggableType): void

  public debug(message: LoggableType): void {
    this.log(NexxusLoggerLevels.DEBUG, message);
  }

  public info(message: LoggableType): void {
    this.log(NexxusLoggerLevels.INFO, message);
  }

  public warn(message: LoggableType): void {
    this.log(NexxusLoggerLevels.WARNING, message);
  }

  public error(message: LoggableType): void {
    this.log(NexxusLoggerLevels.ERROR, message);
  }

  public critical(message: LoggableType): void {
    this.log(NexxusLoggerLevels.CRITICAL, message);
  }

  public alert(message: LoggableType): void {
    this.log(NexxusLoggerLevels.ALERT, message);
  }

  public emerg(message: LoggableType): void {
    this.log(NexxusLoggerLevels.EMERGENCY, message);
  }
}

export class WinstonNexxusLogger extends BaseNexxusLogger {
  private winston : Winston.Logger;
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/winston-logger.schema.json");
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: [
      {
        name: "LOG_LEVEL",
        location: "logger.level"
      }
    ]
  };
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  }

  constructor(config: Object) {
    super();

    this.config = config;

    let format : Winston.Logform.Format;

    if (this.config.logType === "json") {
      format = Winston.format.json({
        circularValue: '[circular]'
      });

      format = Winston.format.combine(
        Winston.format.printf(info => {
          if (info.message === undefined) {
            const { level, label, timestamp, ...rest } = info;
            const restkeys = Object.keys(rest);

            restkeys.forEach(key => {
              delete info[key];
            });

            info.message = rest;
          }

          info.label = info.label || "default-label";

          return JSON.stringify(info);
        }),
        format
      );

      format = Winston.format.combine(
        Winston.format.label({ label: this.config.label, message: false }),
        format
      )

      if (this.config.timestamps) {
        format = Winston.format.combine(
          Winston.format.timestamp(),
          format
        );
      }
    } else {
      format = Winston.format.printf(info => {
        let result = '';

        if (info.message === undefined) {
          const isMetadataEmpty = Object.keys(info.metadata as object).length === 0;

          info.message = isMetadataEmpty ? 'undefined' :JSON.stringify(info.metadata);
        }

        info.label = info.label || "default-label";

        if (info.timestamp){
          result += `[${info.timestamp}] `;
        }

        return result + `${info.level.toLocaleUpperCase()} [${info.label}]: ${info.message}`;
      });

      format = Winston.format.combine(
        Winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
        format
      );

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

  public log(level: NexxusLoggerLevels, message: LoggableType): void {
    this.winston.log(level, message);
  }
}
