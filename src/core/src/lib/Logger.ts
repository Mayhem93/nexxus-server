import { ConfigEnvVars, ConfigCliArgs } from './ConfigManager';
import { NexxusBaseService, INexxusBaseServices } from './BaseService';
import { NexxusConfig } from './ConfigProvider';

import * as Winston from 'winston';

import * as path from "node:path";

type LoggableType = string | object | number | boolean | null | undefined;

export const enum NexxusLoggerLevels {
  EMERGENCY = "emerg",
  ALERT = "alert",
  CRITICAL = "crit",
  ERROR = "error",
  WARNING = "warn",
  NOTICE = "notice",
  INFO = "info",
  DEBUG = "debug"
}

type WinstonNexxusLoggerConfig = {
  level: NexxusLoggerLevels;
  logType: "json" | "text";
  timestamps: boolean;
  colors: boolean;
} & NexxusConfig;

export interface INexxusLogger {
  log(level: NexxusLoggerLevels, message: LoggableType, label?: string): void
}

export interface INexxusAsyncLogger extends INexxusLogger {
  log(level: NexxusLoggerLevels, message: LoggableType, label?: string): Promise<void>
}

interface NexxusLoggerServices extends Omit<INexxusBaseServices, 'logger'> {}

export abstract class NexxusBaseLogger<T extends NexxusConfig> extends NexxusBaseService<T> implements INexxusLogger {

  constructor(services: NexxusLoggerServices) {
    super(services.configManager.getConfig('logger') as T);
  }

  public abstract log(level: NexxusLoggerLevels, message: LoggableType, label?: string): void

  public debug(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.DEBUG, message, label);
  }

  public info(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.INFO, message, label);
  }

  public warn(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.WARNING, message, label);
  }

  public error(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.ERROR, message, label);
  }

  public critical(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.CRITICAL, message, label);
  }

  public alert(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.ALERT, message, label);
  }

  public emerg(message: LoggableType, label?: string): void {
    this.log(NexxusLoggerLevels.EMERGENCY, message, label);
  }
}

export class WinstonNexxusLogger extends NexxusBaseLogger<WinstonNexxusLoggerConfig> {
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

  constructor(services: NexxusLoggerServices) {
    super(services);

    let format : Winston.Logform.Format;

    if (this.config.logType === "json") {
      format = Winston.format.json({
        circularValue: '[circular]'
      });

      format = Winston.format.combine(
        Winston.format.printf(info => {
          const msg = info.message as string;

          if (msg.startsWith("{") || msg.startsWith("[")) {
            try {
              info.message = JSON.parse(msg);
            } catch (e) {
              if (e.message.includes("Unexpected")) {
                info.message = msg;
              } else {
                throw e;
              }
            }
          }

          info.label = info.label || "default-label";

          return JSON.stringify(info);
        }),
        format
      );

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

  public log(level: NexxusLoggerLevels, message: LoggableType, label?: string): void {
    if (typeof message === 'object' || Array.isArray(message)) {
      message = JSON.stringify(message);
    } else {
      message = String(message);
    }
    this.winston.log(level, message, { label });
  }
}
