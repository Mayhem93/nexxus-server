# @mayhem93/nexxus-worker

> Background workers for Nexxus - Process queued operations and route real-time notifications

---

## Overview

The **Worker package** contains the background processing infrastructure that handles asynchronous operations in Nexxus. Workers consume messages from queues, perform business logic, and publish results to downstream queues in a pipeline architecture.

**Key Responsibility:** Execute database writes, route notifications based on subscriptions, and deliver updates to connected clients via transport workers.

---

## Features

### 🔄 Pipeline Architecture

- **Chain workers** in sequence for multi-stage processing
- **Parallel execution** across multiple worker instances
- **Independent scaling** per worker type
- **Custom workers** can be inserted at any pipeline stage

### ⚡ Built-in Workers

- **Writer Worker** - Persists app model changes to database
- **Transport Manager Worker** - Routes notifications to appropriate devices
- **WebSocket Worker** - Delivers updates to WebSocket connections

### 🎯 Worker Characteristics

- **Stateless** - No shared state between instances
- **Idempotent** - Safe to retry operations
- **Queue-based** - Decoupled from other services
- **Fault-tolerant** - Handles failures gracefully

---

## Architecture

```
                    ┌─────────────────┐
                    │   API Server    │
                    └────────┬────────┘
                             │ publish
                             ↓
                    ┌─────────────────┐
                    │  Writer Queue   │
                    └────────┬────────┘
                             │ consume
                             ↓
                    ┌─────────────────┐
                    │ Writer Worker   │───→ Database
                    └────────┬────────┘
                             │ publish
                             ↓
              ┌──────────────────────────┐
              │ Transport Manager Queue  │
              └────────────┬─────────────┘
                           │ consume
                           ↓
              ┌──────────────────────────┐
              │ Transport Manager Worker │───→ Redis
              └────────────┬─────────────┘     (subscriptions)
                           │ publish
                           ↓
              ┌──────────────────────────┐
              │ WebSocket Transport Queue│
              └────────────┬─────────────┘
                           │ consume
                           ↓
              ┌──────────────────────────┐
              │   WebSocket Worker       │───→ Connected Clients
              └──────────────────────────┘
```

---

## Built-in Workers

### Writer Worker

**Queue:** `writer`

**Purpose:** Persist app model CRUD operations to database

**Input Payloads:**

- `NexxusModelCreatedPayload` - Create new model instance
- `NexxusModelUpdatedPayload` - Update existing model (array of JsonPatches)
- `NexxusModelDeletedPayload` - Delete model instance

**Process:**

1. Consume message from `writer` queue
2. Validate payload and model schema
3. Execute database operation (create/update/delete)
4. Publish change event to `transport-manager` queue

**Output Queue:** `transport-manager`

**Scaling:** Multiple instances for parallel writes

---

### Transport Manager Worker

**Queue:** `transport-manager`

**Purpose:** Determine which devices should receive notifications

**Input Payloads:**

- `NexxusModelCreatedPayload`
- `NexxusModelUpdatedPayload`
- `NexxusModelDeletedPayload`

**Process:**

1. Consume change event from `transport-manager` queue
2. Generate subscription patterns from change metadata
3. Query Redis for matching subscriptions (filtered & unfiltered)
4. For filtered subscriptions, test change against FilterQuery
5. Collect device IDs grouped by transport type
6. Publish device-specific messages to transport queues

**Output Queues:**

- `websockets-transport` (with slim metadata)
- `mqtt-transport` (future)
- Other custom transport queues

**Key Logic:**

```typescript
// Subscription pattern generation
Input: { appId: 'myapp', userId: 'user123', model: 'task', modelId: 'task-456' }

Patterns generated:
- { appId: 'myapp', model: 'task' }
- { appId: 'myapp', model: 'task', modelId: 'task-456' }
- { appId: 'myapp', userId: 'user123', model: 'task' }
- { appId: 'myapp', userId: 'user123', model: 'task', modelId: 'task-456' }
```

**Filter Testing:**

```typescript
// Subscription has filter: { "priority": { "$eq": "high" } }
// Change: { priority: "high", status: "todo" }
// Result: MATCH → Include device in notification
```

**Scaling:** Multiple instances process different changes in parallel

---

### WebSocket Worker

**Queue:** `websockets-transport`

**Purpose:** Push real-time updates to WebSocket connections

**Input Payload:**

```typescript
{
  event: 'device_message',
  deviceIds: ['device-123', 'device-456'],
  data: {
    event: 'model_updated',
    data: [{
      op: 'replace',
      path: ['status'],
      value: ['completed'],
      metadata: {
        channels: ['app:myapp:model:task', 'app:myapp:user:user123:model:task']
      }
    }]
  }
}
```

**Process:**

1. Consume device message from `websockets-transport` queue
2. Look up active WebSocket connections by device ID
3. Send JSON payload to each connected client
4. Handle disconnected clients (ignore, clean up subscriptions)

**Connection Management:**

- Tracks active WebSocket connections
- Maps device IDs to WebSocket instances
- Removes subscriptions on disconnect
- Supports multiple connections per device

**Scaling:** Sticky sessions or shared connection registry required

---

## Worker Pipeline Flow

### Create Operation

```
1. Client: POST /model/task
   ↓
2. API: Publish to writer queue
   Payload: { event: 'model_created', data: { appId, userId, type, id, ...fields } }
   ↓
3. Writer Worker: Consume from writer queue
   - Execute: database.createItem(data)
   - Publish to transport-manager queue (same payload)
   ↓
4. Transport Manager: Consume from transport-manager queue
   - Query Redis for subscriptions
   - Filter by channel patterns and FilterQuery
   - Group devices by transport
   - Publish to websockets-transport queue
   Payload: { event: 'device_message', deviceIds: [...], data: {...} }
   ↓
5. WebSocket Worker: Consume from websockets-transport queue
   - Find active connections for deviceIds
   - Send to each client: { event: 'model_created', data: {...} }
```

### Update Operation

```
1. Client: PATCH /model/task/123
   ↓
2. API: Publish to writer queue
   Payload: { event: 'model_updated', data: [JsonPatch1, JsonPatch2] }
   ↓
3. Writer Worker: Consume from writer queue
   - Execute: database.updateItem(patches)
   - Publish to transport-manager queue (same payload)
   ↓
4. Transport Manager: Consume from transport-manager queue
   - For each patch, check subscriptions
   - Test against FilterQuery (if filtered)
   - Collect matching devices
   - Transform to slim metadata:
     Full: { op, path, value, metadata: { appId, userId, type, id } }
     Slim: { op, path, value, metadata: { channels: [...] } }
   - Publish to transport queues
   ↓
5. WebSocket Worker: Consume from websockets-transport queue
   - Deliver slim patches to clients
```

---

## Custom Worker Pipeline

### Adding a Custom Worker

You can insert custom workers at any point in the pipeline for additional processing.

**Example: Email Notification Worker**

```
Writer Worker
    ├─→ Transport Manager Queue (existing)
    └─→ Email Worker Queue (custom)
          ↓
       Email Worker
          - Check if change triggers email
          - Send notification email
          - Log delivery status
```

**Queue Configuration:**

```typescript
{
  queues: {
    'writer': { /* config */ },
    'transport-manager': { /* config */ },
    'email-notifications': { /* config */ },  // Custom queue
    'websockets-transport': { /* config */ }
  }
}
```

---

### Custom Worker Types

**Pre-processing Worker:**

- Position: Before Writer Worker
- Purpose: Validate, transform, or enrich data before persistence

**Post-processing Worker:**

- Position: After Writer Worker (parallel to Transport Manager)
- Purpose: Trigger side effects (emails, webhooks, analytics)

**Filter Worker:**

- Position: Before Transport Manager
- Purpose: Additional filtering logic, rate limiting, aggregation

**Transform Worker:**

- Position: After Transport Manager
- Purpose: Format notifications per transport (SMS, push, email)

---

## Worker Lifecycle

### Initialization

1. Load configuration (database, message queue, redis)
2. Connect to dependencies (DB, Redis, RabbitMQ)
3. Subscribe to queue(s)
4. Start consuming messages

### Message Processing

1. Receive message from queue
2. Deserialize payload
3. Execute business logic
4. Publish to downstream queue(s)
5. Acknowledge message (auto/manual)

### Graceful Shutdown

1. Stop accepting new messages
2. Wait for in-flight messages to complete
3. Disconnect from dependencies
4. Exit process

---

## Scaling Strategies

### Horizontal Scaling

**Run multiple instances per worker type:**

```bash
# Writer Workers (3 instances)
worker-1: node writer.js
worker-2: node writer.js
worker-3: node writer.js

# Transport Manager Workers (2 instances)
tm-1: node transport-manager.js
tm-2: node transport-manager.js

# WebSocket Workers (sticky sessions required)
ws-1: node websocket.js
ws-2: node websocket.js
```

**Message Distribution:**

- RabbitMQ distributes messages across instances (round-robin)
- Each instance processes a subset of messages
- No coordination needed (stateless workers)

## Package Structure

```
src/
├── workers/
│   ├── WriterWorker.ts          # Database persistence
│   ├── TransportManager.ts      # Notification routing
│   └── WebSocketWorker.ts       # WebSocket delivery
│
├── base/
│   └── BaseWorker.ts            # Abstract worker class
│
└── index.ts                     # Public exports
```

---

## Configuration

### Worker Configuration

```typescript
{
  workers: {
    writer: {
      enabled: true,
      instances: 3,           // Number of worker instances
      queue: 'writer',
      prefetch: 10,          // Messages to process concurrently
      autoAck: false         // Manual acknowledgment
    },
    transportManager: {
      enabled: true,
      instances: 2,
      queue: 'transport-manager',
      prefetch: 5
    },
    websocket: {
      enabled: true,
      instances: 2,
      queue: 'websockets-transport',
      prefetch: 20,
      port: 8080            // WebSocket server port
    }
  }
}
```

---

### Database Configuration

```typescript
{
  database: {
    adapter: 'elasticsearch',
    nodes: ['http://localhost:9200']
  }
}
```

---

### Message Queue Configuration

```typescript
{
  messageQueue: {
    adapter: 'rabbitmq',
    url: 'amqp://localhost:5672',
    options: {
      prefetch: 10,
      reconnectDelay: 5000
    }
  }
}
```

---

### Redis Configuration

```typescript
{
  redis: {
    mode: 'cluster',
    nodes: [
      { host: 'redis-1.example.com', port: 6379 },
      { host: 'redis-2.example.com', port: 6379 }
    ]
  }
}
```

---

## WebSocket Protocol

### Client Connection

```
ws://localhost:8080
```

**Authentication:**

- JWT token passed as query parameter
- Validated on connection
- Device ID extracted from token

---

### Message Format (Server → Client)

**Model Created:**

```json
{
  "event": "model_created",
  "data": {
    "appId": "myapp",
    "userId": "user123",
    "type": "task",
    "id": "task-456",
    "title": "New Task",
    "status": "todo"
  }
}
```

**Model Updated (Slim Metadata):**

```json
{
  "event": "model_updated",
  "data": [
    {
      "op": "replace",
      "path": ["status"],
      "value": ["completed"],
      "metadata": {
        "channels": [
          "app:myapp:model:task",
          "app:myapp:user:user123:model:task"
        ]
      }
    }
  ]
}
```

**Model Deleted:**

```json
{
  "event": "model_deleted",
  "data": {
    "appId": "myapp",
    "userId": "user123",
    "type": "task",
    "id": "task-456"
  }
}
```

---

### Connection Lifecycle

**Connect:**

1. Client opens WebSocket connection
2. Server validates JWT token
3. Server registers device in Redis
4. Connection established

**Disconnect:**

1. Client closes connection (or network failure)
2. Server detects disconnect
3. Server removes device subscriptions from Redis
4. Server deletes device entry from Redis

---

## Dependencies

**Runtime:**

- `ws` (WebSocket library)
- `@mayhem93/nexxus-core` (models, FilterQuery, JsonPatch, payloads)
- `@mayhem93/nexxus-database` (database operations)
- `@mayhem93/nexxus-message-queue` (queue operations)
- `@mayhem93/nexxus-redis` (subscription lookups)

**DevDependencies:**

- TypeScript
- Node.js type definitions

---

## Status

🚧 **Work in Progress** - Additional workers and features planned.

**Coming Soon:**

- MQTT transport worker
- SSE transport worker
- Worker monitoring dashboard
- Custom worker scaffolding tool

---

## Related Packages

- **[@mayhem93/nexxus-core](../core/)** - Payload types, FilterQuery, JsonPatch
- **[@mayhem93/nexxus-api](../api/)** - Publishes to writer queue
- **[@mayhem93/nexxus-database](../database/)** - Used by Writer Worker
- **[@mayhem93/nexxus-redis](../redis/)** - Used by Transport Manager
- **[@mayhem93/nexxus-message-queue](../message_queue/)** - Queue infrastructure

---

## License

MPL-2.0
