import { ConfigCliArgs,
  ConfigEnvVars,
  NexxusConfig,
  NexxusGlobalServices as NxxSvcs,
  FatalErrorException
} from "@nexxus/core";
import { NexxusMessageQueueAdapter,
  NexxusMessageQueueAdapterEvents,
  NexxusBasePayload }
from "./MessageQueueAdapter";

import * as amqplib from "amqplib";

import * as path from "node:path";

type RabbitMQConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  exclusive: boolean;
  worker_name: string;
} & NexxusConfig;

export type NexxusRabbitMqMsgPayload = NexxusBasePayload & {
  fields: {
    consumerTag: string;
    deliveryTag: number;
    redelivered: boolean;
    exchange: string;
    routingKey: string;
  },
  properties: {
    contentType: string;
    contentEncoding: string;
    headers: Record<string, any>;
    deliveryMode: number;
    priority: number;
    correlationId: string;
    replyTo: string;
    expiration: string;
    messageId: string;
    timestamp: number;
    type: string;
    userId: string;
    appId: string;
    clusterId: string;
  },
  content?: Buffer;
}

interface NexxusRabbitMqEvents extends NexxusMessageQueueAdapterEvents {}

export class NexxusRabbitMq extends NexxusMessageQueueAdapter<RabbitMQConfig, NexxusRabbitMqEvents> {
  protected static loggerLabel: Readonly<string> = "NxxRabbitMq";
  protected static schemaPath: string = path.join(__dirname, "../../src/schemas/rabbitmq.schema.json");
  protected static envVars: ConfigEnvVars = {
    source: this.name,
    specs: [
      {
        name: "MQ_HOST",
        location: "message_queue.host"
      },
      {
        name: "MQ_PORT",
        location: "message_queue.port"
      },
      {
        name: "MQ_USER",
        location: "message_queue.user"
      },
      {
        name: "MQ_PASSWORD",
        location: "message_queue.password"
      }
    ]
  };
  protected static cliArgs: ConfigCliArgs = {
    source: this.name,
    specs: []
  };

  private connection: amqplib.ChannelModel | null = null;
  private channel: amqplib.Channel | null = null;

  async connect(): Promise<void> {
    try {
      this.connection = await amqplib.connect({
        protocol: 'amqp',
        hostname: this.config.host,
        port: this.config.port,
        username: this.config.user,
        password: this.config.password,
        vhost: '/nexxus',
        heartbeat: 10
      });
    } catch (err) {
      if (err.name === 'AggregateError') {
        throw new FatalErrorException(`Failed to connect to RabbitMQ server: ${(err as Error).message}`);
      }

      throw err;
    }

    this.connection.on('error', (err) => {
      NxxSvcs.logger.error(`RabbitMQ connection error: ${err.message}`, NexxusRabbitMq.loggerLabel);

      this.reConnect().catch(reconnectErr => {
        NxxSvcs.logger.error(`Failed to reconnect to RabbitMQ: ${reconnectErr.message}`, NexxusRabbitMq.loggerLabel);
      });
    });

    this.channel = await this.connection.createChannel();

    NxxSvcs.logger.info("Connected to RabbitMQ server", NexxusRabbitMq.loggerLabel);
  }

  async reConnect(): Promise<void> {
    // Implementation for reconnecting to RabbitMQ
  }

  async disconnect(): Promise<void> {
    if(this.connection) {
      await this.connection.close();

      this.connection = null;
    }
  }

  async publishMessage(queueName: string, message: any): Promise<void> {
    // Implementation for publishing a message to a RabbitMQ queue
    const messageBuffer = Buffer.from(JSON.stringify(message));

    // TODO: remove queue assertions when implementing a rabbitmq bootstrap process
    const res = await this.channel?.assertQueue(queueName, { durable: true });

    if (res === undefined) {
      throw new FatalErrorException(`Failed to assert RabbitMQ queue ${queueName}`);
    }

    NxxSvcs.logger.debug(`Asserted RabbitMQ queue ${res.queue}`, NexxusRabbitMq.loggerLabel);

    this.channel?.sendToQueue(queueName, messageBuffer, { persistent: true, contentType: 'application/json' });
  }

  async consumeMessages(queueName: string, onMessage: (message: NexxusRabbitMqMsgPayload) => Promise<void> ) : Promise<void> {
    await this.channel?.consume(queueName, async msg => {
      if (msg !== null) {
        const messageContent = msg.content.toString();
        const messageObject = { nxx_payload: JSON.parse(messageContent), ...msg } as NexxusRabbitMqMsgPayload;

        delete messageObject.content;

        NxxSvcs.logger.debug(`Received message from RabbitMQ queue ${queueName}: ${messageContent}`, NexxusRabbitMq.loggerLabel);

        await onMessage(messageObject);

        this.channel?.ack(msg);
      }
    });

    return Promise.resolve();
  }
}
