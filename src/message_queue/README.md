# @nexxus/message_queue

> Message broker abstraction for Nexxus - Pluggable adapters for event-driven communication

---

## Overview

The **Message Queue package** provides a unified interface for asynchronous communication between Nexxus services. It comes with a built-in RabbitMQ adapter and allows developers to implement adapters for any message broker of their choice.

**Key Responsibility:** Enable reliable, decoupled communication between API, workers, and transport layers using publish-subscribe and queue patterns.

---

## Features

### 🔌 Pluggable Architecture

- Built-in **RabbitMQ** adapter
- Extend `MessageQueueAdapter` for other brokers (Kafka, Redis Streams, AWS SQS, etc.)
- Consistent API regardless of underlying message broker

### 📨 Communication Patterns

- **Topic-based** (broadcast/pub-sub) - One message, multiple consumers
- **Queue-based** (point-to-point) - One message, one consumer
- **Work queues** - Distribute tasks across multiple workers

### 🔄 Reliability

- Message acknowledgment (manual/auto)
- Delivery guarantees (at-least-once, exactly-once where supported)
- Dead letter queues for failed messages
- Retry mechanisms

### 🎯 Type-Safe Payloads

- Strongly-typed message payloads from `@nexxus/core`
- Queue names as constants (`NexxusQueueName`)
- Payload validation at compile-time

---

## Architecture

```
Publisher (API/Worker)
      ↓
MessageQueueAdapter (Abstract)
      ↓
   ┌──────────────────────────────┐
   │  RabbitMQAdapter             │ (Built-in)
   │  KafkaAdapter                │ (Custom)
   │  RedisStreamsAdapter         │ (Custom)
   │  SQSAdapter                  │ (Custom)
   └──────────────────────────────┘
      ↓
Message Broker
      ↓
Consumer (Worker)
```

---

## Message Flow in Nexxus

### Write Operation Flow

```
API Server
    ↓ [publish]
Writer Queue (writer)
    ↓ [consume]
Writer Worker
    ↓ [publish]
Transport Manager Queue (transport-manager)
    ↓ [consume]
Transport Manager Worker
    ↓ [publish]
WebSocket Queue (websockets-transport)
    ↓ [consume]
WebSocket Worker
    ↓
Connected Clients
```

### Queue Names (from `@nexxus/core`)

```typescript
export type NexxusQueueName =
  | 'writer'                    // API → Writer Worker
  | 'transport-manager'         // Writer → Transport Manager
  | 'websockets-transport'      // Transport Manager → WebSocket Worker
  | string;                     // Custom worker queues
```

---

## Built-in Adapter: RabbitMQ

### Why RabbitMQ?

- **Reliable** message delivery with acknowledgments
- **Flexible routing** with exchanges and bindings
- **Battle-tested** in production environments
- **Feature-rich** dead letter queues, TTL, priority queues
- **AMQP protocol** standard

### Features

- Exchange types: direct, topic, fanout, headers
- Persistent messages (survive broker restarts)
- Consumer prefetch (control throughput)
- Connection/channel management
- Automatic reconnection

---

## Core Operations

### Publish Message

```typescript
// Publish to queue
await messageQueue.publish('writer', {
  event: 'model_created',
  data: {
    appId: 'myapp',
    userId: 'user123',
    type: 'task',
    id: 'task-456',
    title: 'New Task',
    status: 'todo'
  }
});

// Publish with options
await messageQueue.publish('writer', payload, {
  persistent: true,      // Survive broker restart
  priority: 5,          // Higher priority (0-10)
  expiration: '60000'   // Message TTL in ms
});
```

### Subscribe to Queue

```typescript
// Subscribe with callback
await messageQueue.subscribe('writer', async (payload) => {
  console.log('Received:', payload);

  if (payload.event === 'model_created') {
    // Handle model creation
    await database.createItem(payload.data);
  }

  // Message auto-acknowledged on successful return
  // Throws error to reject and requeue
});

// Subscribe with manual acknowledgment
await messageQueue.subscribe('writer', async (payload, message) => {
  try {
    await processMessage(payload);
    message.ack(); // Manual acknowledgment
  } catch (error) {
    message.nack(); // Reject and requeue
  }
}, { autoAck: false });
```

### Unsubscribe

```typescript
await messageQueue.unsubscribe('writer');
```

---

## Message Payloads (from `@nexxus/core`)

### Model Created

```typescript
{
  event: 'model_created',
  data: {
    appId: string;
    userId?: string;
    type: string;        // Model type (e.g., 'task')
    id: string;          // Model ID
    [key: string]: any;  // Model fields
  }
}
```

### Model Updated

```typescript
{
  event: 'model_updated',
  data: Array<NexxusJsonPatchInternal>  // Array of patches
}
```

**Writer → Transport Manager:**
Full metadata in patches:

```typescript
{
  op: 'replace',
  path: ['status'],
  value: ['completed'],
  metadata: {
    appId: string;
    userId?: string;
    type: string;
    id: string;
  }
}
```

**Transport Manager → WebSocket Worker:**
Slim metadata with channel keys:

```typescript
{
  op: 'replace',
  path: ['status'],
  value: ['completed'],
  metadata: {
    channels: string[];  // Array of subscription channel keys
  }
}
```

### Model Deleted

```typescript
{
  event: 'model_deleted',
  data: {
    appId: string;
    userId?: string;
    type: string;
    id: string;
  }
}
```

### Device Message (Transport-specific)

```typescript
{
  event: 'device_message',
  deviceIds: string[];  // Target devices
  data: NexxusWebSocketModelUpdatedPayload | NexxusModelCreatedPayload | NexxusModelDeletedPayload
}
```

---

## Custom Adapter Implementation

### Step 1: Extend MessageQueueAdapter

```typescript
import { MessageQueueAdapter } from '@nexxus/message_queue';

export class KafkaMessageQueueAdapter extends MessageQueueAdapter {
  private producer: Kafka.Producer;
  private consumer: Kafka.Consumer;

  async connect(config: any) {
    const kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers
    });

    this.producer = kafka.producer();
    this.consumer = kafka.consumer({ groupId: config.groupId });

    await this.producer.connect();
    await this.consumer.connect();
  }

  async disconnect() {
    await this.producer.disconnect();
    await this.consumer.disconnect();
  }

  async publish(queue: string, payload: any, options?: any) {
    await this.producer.send({
      topic: queue,
      messages: [{
        value: JSON.stringify(payload),
        headers: options?.headers
      }]
    });
  }

  async subscribe(queue: string, callback: (payload: any) => Promise<void>, options?: any) {
    await this.consumer.subscribe({ topic: queue });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const payload = JSON.parse(message.value.toString());
        await callback(payload);
      }
    });
  }

  async unsubscribe(queue: string) {
    // Kafka-specific unsubscribe logic
  }
}
```

### Step 2: Register Adapter

```typescript
const messageQueue = new KafkaMessageQueueAdapter();
await messageQueue.connect({
  clientId: 'nexxus',
  brokers: ['localhost:9092'],
  groupId: 'nexxus-workers'
});
```

---

## Configuration

### RabbitMQ (Built-in)

```typescript
{
  messageQueue: {
    url: "amqp://localhost:5672",
    // Or with auth
    url: "amqp://user:password@localhost:5672",
    options: {
      heartbeat: 60,
      prefetch: 10,        // Messages to prefetch per consumer
      reconnectDelay: 5000 // Reconnection delay in ms
    }
  }
}
```

### Custom Adapter

```typescript
{
  messageQueue: {
    clientId: "nexxus",
    brokers: ["localhost:9092"],
    groupId: "nexxus-workers"
  }
}
```

---

## Package Structure

```
src/
├── lib/
│   ├── RabbitMQAdapter.ts        # Built-in RabbitMQ adapter
│   ├── MessageQueueAdapter.ts    # Abstract base class
│   └── MessageQueueService.ts    # Service wrapper
│
└── index.ts                      # Public exports
```

---

## Key Classes

### `MessageQueueAdapter` (Abstract)

Base class for all message queue adapters.

**Abstract Methods:**

- `connect(config: any): Promise<void>`
- `disconnect(): Promise<void>`
- `publish(queue: string, payload: any, options?: any): Promise<void>`
- `subscribe(queue: string, callback: Function, options?: any): Promise<void>`
- `unsubscribe(queue: string): Promise<void>`

### `RabbitMQAdapter`

RabbitMQ implementation of `MessageQueueAdapter`.

**Features:**

- AMQP 0-9-1 protocol support
- Connection and channel pooling
- Automatic reconnection on failure
- Exchange declaration (direct, topic, fanout)
- Queue assertion with options (durable, auto-delete)
- Message acknowledgment (manual/auto)
- Dead letter exchange configuration

---

## Worker Pipeline Example

### Custom Email Worker

```typescript
import { MessageQueueAdapter, NexxusModelCreatedPayload } from '@nexxus/message_queue';

class EmailWorker {
  constructor(private messageQueue: MessageQueueAdapter) {}

  async start() {
    await this.messageQueue.subscribe('email-notifications', async (payload: NexxusModelCreatedPayload) => {
      if (payload.event === 'model_created' && payload.data.type === 'task') {
        await this.sendEmail(payload.data);
      }
    });
  }

  private async sendEmail(task: any) {
    // Send email notification
    console.log(`Sending email for task: ${task.title}`);
  }
}

// Register in pipeline
// Writer Worker publishes to both 'transport-manager' and 'email-notifications'
```

### Adding to Pipeline

```typescript
// In Writer Worker
async handleModelCreated(payload: NexxusModelCreatedPayload) {
  // Persist to database
  await database.createItem(payload.data);

  // Publish to Transport Manager (real-time notifications)
  await messageQueue.publish('transport-manager', payload);

  // Publish to Email Worker (custom logic)
  await messageQueue.publish('email-notifications', payload);
}
```

---

## Dependencies

**Runtime:**

- `amqplib` (RabbitMQ client)
- `@nexxus/core` (queue payload types)

**DevDependencies:**

- TypeScript
- Node.js type definitions

---

## Usage in Other Packages

```typescript
// In @nexxus/api
import { MessageQueueAdapter } from '@nexxus/message_queue';

await messageQueue.publish('writer', {
  event: 'model_created',
  data: newTask
});

// In @nexxus/worker (Writer)
import { NexxusModelCreatedPayload } from '@nexxus/core';

await messageQueue.subscribe('writer', async (payload: NexxusModelCreatedPayload) => {
  await handleModelCreated(payload);
});
```

---

## Adapter Examples

### Kafka

```typescript
class KafkaAdapter extends MessageQueueAdapter {
  // Topics instead of queues
  // Consumer groups for load balancing
  // Offset management for replay capability
  // Partitioning for ordering guarantees
}
```

### Redis Streams

```typescript
class RedisStreamsAdapter extends MessageQueueAdapter {
  // Lightweight, in-memory messaging
  // Consumer groups with XREADGROUP
  // Message acknowledgment with XACK
  // Ideal for high-throughput scenarios
}
```

### AWS SQS

```typescript
class SQSAdapter extends MessageQueueAdapter {
  // Fully managed queue service
  // Visibility timeout for processing time
  // Long polling for efficiency
  // FIFO queues for ordering
}
```

### Google Cloud Pub/Sub

```typescript
class PubSubAdapter extends MessageQueueAdapter {
  // Global messaging service
  // Topic-based pub-sub
  // Push and pull delivery
  // Automatic scaling
}
```

---

## Status

🚧 **Work in Progress** - Additional adapters and patterns planned.

**Coming Soon:**

- Request-reply pattern support
- Message compression
- Schema validation
- Monitoring and metrics integration

---

## Related Packages

- **[@nexxus/core](../core/)** - Queue payload types and constants
- **[@nexxus/api](../api/)** - Publishes to writer queue
- **[@nexxus/worker](../worker/)** - Consumes and publishes messages

---

## License

MPL-2.0
