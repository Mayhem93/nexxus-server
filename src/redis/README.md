# @nexxus/redis

> Redis-based subscription and device storage for Nexxus - Fast lookups for real-time routing

---

## Overview

The **Redis package** provides the infrastructure for storing active subscriptions and connected devices. It enables the Transport Manager to quickly determine which devices should receive notifications based on model changes.

**Key Responsibility:** Maintain real-time mappings between channels, filters, devices, and their subscriptions to enable efficient notification routing.

**Note:** Redis is **not pluggable** - it is the only supported storage mechanism for subscriptions and devices.

---

## Features

### 🚀 High-Performance Storage

- **In-memory** storage for sub-millisecond lookups
- **Partitioning** support for horizontal scaling
- **Cluster mode** for production deployments
- **Single-node mode** for development

### 📡 Subscription Management

- Channel-based subscriptions (filtered and unfiltered)
- Device-to-subscription mappings
- Filter storage per channel
- Efficient pattern matching

### 📱 Device Tracking

- Active device registry
- Transport-aware device identifiers
- Connection state management
- Multi-device per user support

---

## Architecture

```
Transport Manager Worker
      ↓
   Check Subscriptions
      ↓
Redis Storage
   ├── Subscriptions (by channel + filter)
   │   └── Set of device IDs
   ├── Filters (by channel)
   │   └── Hash of filter IDs → FilterQuery
   └── Devices (by device ID)
       └── Device metadata
      ↓
   Matched Devices
      ↓
Route to Transport Queues
```

---

## Key Concepts

### Subscription Channel Structure

```typescript
interface NexxusBaseSubscriptionChannel {
  appId: string;        // Application ID (multi-tenancy)
  userId?: string;      // Optional: user-specific subscriptions
  model: string;        // Model type (e.g., "task", "message")
  modelId?: string;     // Optional: specific object ID
}
```

**Examples:**

- `app:myapp:model:task` - All tasks in app
- `app:myapp:user:user123:model:task` - User's tasks only
- `app:myapp:model:task:id:task-456` - Specific task
- `app:myapp:user:user123:model:task:id:task-456` - User's specific task

---

### Filtered Subscriptions

Subscriptions can include a `FilterQuery` to receive only matching updates.

**Example:**

```typescript
// Subscribe to high-priority tasks only
{
  appId: "myapp",
  model: "task",
  filter: {
    "priority": { "$eq": "high" }
  }
}
```

**Redis Key:**

```
nxx:subscription:app:myapp:model:task:filter:abc123:partition:0
```

**Stored Data:**

- Set of device IDs subscribed with this filter
- Filter definition stored separately in hash

---

### Device Identifier Format

```typescript
type NexxusDeviceTransportString = `${string}|${string}`;
// Example: "device-123|websockets-transport"
```

**Components:**

- `deviceId` - Unique device identifier
- `transport` - Transport type (websockets, mqtt, etc.)

**Why Include Transport?**

- Same device can connect via multiple transports
- Routes notifications to correct transport worker queue
- Enables transport-specific behavior

---

## Subscription Patterns

### Generate Subscription Patterns

The `generateSubscriptionPatterns()` method creates all possible channel patterns for a given change.

**Input:**

```typescript
{
  appId: 'myapp',
  userId: 'user123',
  model: 'task',
  modelId: 'task-456'
}
```

**Output:**

```typescript
[
  // App-level patterns
  { appId: 'myapp', model: 'task' },
  { appId: 'myapp', model: 'task', modelId: 'task-456' },

  // User-level patterns
  { appId: 'myapp', userId: 'user123', model: 'task' },
  { appId: 'myapp', userId: 'user123', model: 'task', modelId: 'task-456' }
]
```

---

## Filter Management

### Store Filter

```typescript
const channel = { appId: 'myapp', model: 'task' };
const filterQuery = new NexxusFilterQuery({
  "priority": { "$eq": "high" }
});

await NexxusRedisSubscription.setFilter(
  channel,
  'filter-abc123',
  filterQuery
);
```

### Get All Filters for Channel

```typescript
const filters = await NexxusRedisSubscription.getAllFilters(channel);
// {
//   'filter-abc123': NexxusFilterQuery,
//   'filter-def456': NexxusFilterQuery
// }
```

### Delete Filter

```typescript
await NexxusRedisSubscription.deleteFilter(channel, 'filter-abc123');
```

---

## Redis Key Structure

### Subscription Keys

**Format:**

```
nxx:subscription:{channelKey}:partition:{partitionId}
nxx:subscription:{channelKey}:filter:{filterId}:partition:{partitionId}
```

**Examples:**

```
nxx:subscription:app:myapp:model:task:partition:0
nxx:subscription:app:myapp:model:task:filter:abc123:partition:0
nxx:subscription:app:myapp:user:user123:model:task:partition:0
nxx:subscription:app:myapp:model:task:id:task-456:partition:0
```

**Data Type:** SET
**Contents:** Device IDs with transport (`device-123|websockets-transport`)

---

### Filter Keys

**Format:**

```
nxx:filters:{channelKey}
```

**Example:**

```
nxx:filters:app:myapp:model:task
```

**Data Type:** HASH
**Contents:** `filterId` → serialized `FilterQuery`

---

### Device Keys

**Format:**

```
nxx:device:{deviceId}
```

**Example:**

```
nxx:device:device-123
```

**Data Type:** HASH
**Contents:**

```
userId: "user-456"
transport: "websockets-transport"
userAgent: "Mozilla/5.0..."
connectedAt: "2026-01-26T10:30:00Z"
```

---

## Partitioning

Subscriptions are **partitioned** for horizontal scaling.

### Why Partitioning?

- Distribute load across Redis cluster nodes
- Enable parallel processing
- Avoid single key hotspots

### Partition Selection

```typescript
// Uses CRC32 hash of channel key
const partitionId = NexxusRedisSubscription.getPartitionId(channelKey);
// Returns: 0-1023 (configurable)
```

### Configuration

```typescript
{
  redis: {
    partitions: 1024  // Number of partitions (default: 1024)
  }
}
```

**Recommendation:**

- Development: 1 partition
- Production (cluster): 1024+ partitions

---

## Redis Modes

### Single-Node Mode (Development)

```typescript
{
  redis: {
    mode: 'single',
    host: 'localhost',
    port: 6379,
    password: 'optional',
    db: 0
  }
}
```

**Use Case:** Local development, testing

---

### Cluster Mode (Production)

```typescript
{
  redis: {
    mode: 'cluster',
    nodes: [
      { host: 'redis-1.example.com', port: 6379 },
      { host: 'redis-2.example.com', port: 6379 },
      { host: 'redis-3.example.com', port: 6379 }
    ],
    options: {
      redisOptions: {
        password: 'cluster-password'
      }
    }
  }
}
```

**Features:**

- Automatic sharding across nodes
- High availability (replication)
- Fault tolerance (failover)

---

## Package Structure

```
src/
├── lib/
│   ├── RedisSubscription.ts    # Subscription management
│   ├── RedisDevice.ts          # Device management
│   └── RedisClient.ts          # Redis connection wrapper
│
└── index.ts                    # Public exports
```

---

## Dependencies

**Runtime:**

- `redis` (official Node.js Redis client)
- `@nexxus/core` (FilterQuery, types)

**DevDependencies:**

- TypeScript
- Node.js type definitions

---

## Limitations

### Not Pluggable

Redis is **hardcoded** as the subscription/device storage mechanism.

**Why?**

- Requires specific data structures (sets, hashes)
- Needs sub-millisecond performance
- Partitioning and clustering requirements
- Simplifies architecture (one less abstraction)

**Future Consideration:**

- Could be abstracted if strong demand for alternatives (e.g., Memcached, Hazelcast)

### No Persistence Guarantees

- Redis is primarily **in-memory**
- Subscriptions are **volatile** (lost on restart)
- Devices must **re-subscribe** after Redis restart

**Mitigation:**

- Enable Redis persistence (RDB/AOF) for durability
- Clients should auto-reconnect and re-subscribe
- Track subscriptions in primary database for recovery

---

## Status

🚧 **Work in Progress** - Additional features and optimizations planned.

**Coming Soon:**

- Subscription expiration (TTL)
- Device activity tracking
- Subscription analytics
- Graceful cleanup on scale-down

---

## Related Packages

- **[@nexxus/core](../core/)** - FilterQuery, channel types
- **[@nexxus/api](../api/)** - Creates subscriptions and devices
- **[@nexxus/worker](../worker/)** - Transport Manager queries subscriptions

---

## License

MPL-2.0
