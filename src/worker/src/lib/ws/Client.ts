import { WebSocket, Data as WebSocketData } from "ws";
import {
  NexxusWsException,
  NexxusWsInvalidParametersException,
  NexxusWsInternalServerException,
  NexxusWsDeviceNotFoundException
} from "./Exceptions";
import { NexxusGlobalServices as NxxSvcs } from "@nexxus/core";
import { NexxusDevice, RedisKeyNotFoundException } from "@nexxus/redis";

import { EventEmitter } from "node:events";

export type ClientEventMap = {
  register: [ deviceId: string ];
}

export interface NexxusWsBaseEvent {
  event: string;
  data: any;
}

// Client → Server events
export type NexxusWsClientMessage = {
  register: {
    deviceId: string;
  };
  // Add more client events here
};

// Server → Client events
export type NexxusWsServerMessage = {
  register: {
    success: boolean;
    message?: string;
  };
  model_update: {
    modelId: string;
    appId: string;
    data: any;
  };
  error: {
    message: string;
    code?: string;
  };
  // Add more server events here
};

// Helper types for type-safe messaging
export type NexxusWsClientEvent<E extends keyof NexxusWsClientMessage = keyof NexxusWsClientMessage> = {
  event: E;
  data: NexxusWsClientMessage[E];
};

export type NexxusWsServerEvent<E extends keyof NexxusWsServerMessage = keyof NexxusWsServerMessage> = {
  event: E;
  data: NexxusWsServerMessage[E];
};

export class NexxusWsClient extends EventEmitter<ClientEventMap> {
  private socket : WebSocket;
  private deviceId?: string;
  public readonly id: string;

  constructor(clientId: string, ws: WebSocket) {
    super();

    this.socket = ws;
    this.id = clientId;

    this.socket.on('message', async (msg: WebSocketData) => {
      const message = JSON.parse(msg.toString()) as NexxusWsClientEvent;

      if (!message.event) {
        this.sendError(new NexxusWsInvalidParametersException('Missing event type in message.'));

        return;
      }

      if (!message.data) {
        this.sendError(new NexxusWsInvalidParametersException('Missing data in message.'));

        return;
      }

      await this.processMessage(message);
    });
  }

  public isRegistered() : boolean {
    return !!this.deviceId;
  }

  public getDeviceId() : string | undefined {
    return this.deviceId;
  }

  public getId() : string {
    return this.id;
  }

  public async processMessage(message: NexxusWsClientEvent) {
    try {
      switch (message.event) {
        case 'register':
          await this.registerDevice(message);
          break;
        default:
          NxxSvcs.logger.warn(`Unknown client event: ${message.event}`, 'NexxusWsClient');
      }
    } catch (e) {
      if (!(e instanceof NexxusWsException)) {
        e = new NexxusWsInternalServerException('An unexpected error occurred while processing the message.');
      }

      this.sendError(e);
    }
  }

  private sendError(error: NexxusWsException) {
    const errorMessage: NexxusWsServerEvent<'error'> = {
      event: 'error',
      data: {
        message: error.message,
        code: error.name
      }
    };

    this.socket.send(JSON.stringify(errorMessage));
  }

  public sendMessage<E extends keyof NexxusWsServerMessage>(event: E, data: NexxusWsServerMessage[E]) {
    const message: NexxusWsServerEvent<E> = { event, data };

    this.socket.send(JSON.stringify(message));
    NxxSvcs.logger.debug(`Sent message to client ${this.id}: "${JSON.stringify(message)}"`, 'NexxusWsClient');
  }

  private async registerDevice(msg: NexxusWsClientEvent<'register'>) {
    if (this.isRegistered()) {
      NxxSvcs.logger.warn(`Client ${this.id} is already registered with device ID: "${this.deviceId}"`, 'NexxusWsClient');

      return ;
    }

    const deviceId = msg.data.deviceId;

    if (!deviceId || typeof deviceId !== 'string' || deviceId.trim() === '') {
      throw new NexxusWsInvalidParametersException('Invalid or missing deviceId.');
    }

    try {
      await NexxusDevice.get(deviceId);
    } catch (e) {
      if (e instanceof RedisKeyNotFoundException) {
        throw new NexxusWsDeviceNotFoundException(`Device with ID "${deviceId}" not found.`);
      } else {
        throw e;
      }
    }

    this.emit('register', deviceId);
  }
}
