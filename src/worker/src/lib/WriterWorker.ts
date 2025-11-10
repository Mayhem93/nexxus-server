import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig
} from '@nexxus/core';

import { NexxusBaseWorker, NexxusBaseWorkerEvents } from "./BaseWorker";

import * as path from "node:path";

type NexxusWriterWorkerConfig = NexxusConfig & {
  name: string;
}

type NexxusWriterWorkerEvents = NexxusBaseWorkerEvents & {
  message: [string];
};

export class NexxusWriterWorker extends NexxusBaseWorker<NexxusWriterWorkerConfig, NexxusWriterWorkerEvents> {
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/worker.schema.json");

  constructor() {
    super();
  }
}
