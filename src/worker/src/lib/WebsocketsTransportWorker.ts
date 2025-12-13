import {
  ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusQueueName,
  NexxusWebsocketPayload
} from '@nexxus/core';
import { NexxusQueueMessage } from '@nexxus/message_queue';
import { NexxusDevice } from '@nexxus/redis';

import {
  NexxusBaseWorker,
  NexxusBaseWorkerEvents,
  NexxusWorkerServices
} from "./BaseWorker";
import { NexxusWsClient } from './ws/Client';

import * as path from "node:path";
import { WebSocketServer, WebSocket } from "ws";

type NexxusWebsocketsTransportWorkerConfig = NexxusConfig & {
  name: string;
  port: number;
}

type NexxusWebsocketsTransportWorkerEvents = NexxusBaseWorkerEvents & {
  message: [string];
}

export class NexxusWebsocketsTransportWorker extends NexxusBaseWorker<NexxusWebsocketsTransportWorkerConfig, NexxusWebsocketsTransportWorkerEvents, NexxusWebsocketPayload> {
  protected queueName : NexxusQueueName = "websockets-transport";
  protected static loggerLabel: Readonly<string> = "NxxWebsocketsTransportWorker";
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: []
  };
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/websockets-transport-worker.schema.json");

  private server : WebSocketServer;
  private unregisteredClients: Set<NexxusWsClient> = new Set();
  private registeredClients : Map<string, NexxusWsClient> = new Map(); // Map of deviceId to WebSocket client
  private wsToNexxusClientMap: Map<WebSocket, NexxusWsClient> = new Map();

  constructor(services: NexxusWorkerServices) {
    super(services);

    this.server = new WebSocketServer({
      port: this.config.port,
      autoPong: true,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 1
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 2048
      }
    });

    this.server.on('listening', () => {
      NexxusWebsocketsTransportWorker.logger.info(`WebSocket server listening on port ${this.config.port}`, NexxusWebsocketsTransportWorker.loggerLabel);
    });
    this.server.on('connection', this.handleConnection.bind(this));
  }

  public async init() : Promise<void> {
    // TODO: Support multiple workers with IDs
    this.queueName += `_${this.config.workerId || 1}`;
    await super.init();
  }

  protected async processMessage(msg: NexxusQueueMessage<NexxusWebsocketPayload>): Promise<void> {
    NexxusWebsocketsTransportWorker.logger.debug(`Processing message: ${JSON.stringify(msg.payload)}`, NexxusWebsocketsTransportWorker.loggerLabel);

    const payload = msg.payload;

    switch (payload.event) {
      case "device_message":
        NexxusWebsocketsTransportWorker.logger.info(`Received device_message event for device ID: "${payload.deviceId}"`, NexxusWebsocketsTransportWorker.loggerLabel);

        const client = this.registeredClients.get(payload.deviceId);

        if (client) {
          client.sendMessage('model_update', payload.data);
        } else {
          NexxusWebsocketsTransportWorker.logger.warn(`No registered client found for device ID: "${payload.deviceId}"`, NexxusWebsocketsTransportWorker.loggerLabel);
        }

        break;
      default:
        NexxusWebsocketsTransportWorker.logger.warn(`Unknown event type: ${payload.event}`, NexxusWebsocketsTransportWorker.loggerLabel);
    }
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = crypto.randomUUID();
    const client = new NexxusWsClient(clientId, ws);

    NexxusWebsocketsTransportWorker.logger.info(`New client connected with ID: "${clientId}"`, NexxusWebsocketsTransportWorker.loggerLabel);

    this.wsToNexxusClientMap.set(ws, client);
    this.unregisteredClients.add(client);

    client.once('register', async deviceId => {
      await NexxusDevice.update(deviceId, { lastSeen: new Date(), type: 'volatile', connectedTo: this.queueName });

      this.unregisteredClients.delete(client);
      this.registeredClients.set(deviceId, client);
      client.sendMessage('register', { success: true });

      NexxusWebsocketsTransportWorker.logger.info(`Client "${clientId}" registered with device ID: "${deviceId}"`, NexxusWebsocketsTransportWorker.loggerLabel);
    });

    ws.on('close', this.handleDisconnect.bind(this));
  }

  private async handleDisconnect(ws: WebSocket): Promise<void> {
    const nxxWsClient = this.wsToNexxusClientMap.get(ws);
    let deviceId : string | undefined;

    if (!nxxWsClient) {
      return;
    } else {
      deviceId = nxxWsClient.getDeviceId();

      if (deviceId) {
        this.registeredClients.delete(deviceId);

        await NexxusDevice.removeDeviceSubscriptions(deviceId);
        await NexxusDevice.update(deviceId, { lastSeen: new Date(), connectedTo: null });
      } else {
        this.unregisteredClients.delete(nxxWsClient);
      }

      this.wsToNexxusClientMap.delete(ws);
    }

    NexxusWebsocketsTransportWorker.logger.info(`Client "${nxxWsClient.id}" disconnected with device ID: "${deviceId || 'null'}"`, NexxusWebsocketsTransportWorker.loggerLabel);
  }
}
