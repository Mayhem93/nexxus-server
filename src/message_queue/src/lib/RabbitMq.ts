import { ConfigCliArgs, ConfigEnvVars, NexxusConfig } from "@nexxus/core";
import { NexxusMessageQueueAdapter } from "./MessageQueueAdapter";

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

export type QueueName = "writer";

export class NexxusRabbitMq extends NexxusMessageQueueAdapter<RabbitMQConfig> {
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

  constructor(config: RabbitMQConfig) {
    super(config);
  }

  async connect(): Promise<void> {
    this.connection = await amqplib.connect({
      protocol: 'amqp',
      hostname: this.config.host,
      port: this.config.port,
      username: this.config.user,
      password: this.config.password,
      vhost: '/',
      heartbeat: 60
    });

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

  async publishMessage(
    queueName: string,
    message: any
  ): Promise<void> {
    // Implementation for publishing a message to a RabbitMQ queue
  }

  async consumeMessages(
    queueName: string,
    onMessage: (message: any) => Promise<void>
  ): Promise<void> {
    // Implementation for consuming messages from a RabbitMQ queue
  }
}
