# @nexxus/core

> Foundation package for Nexxus - Shared types, models, utilities, and base classes

---

## Overview

The **Core package** provides the foundational building blocks used across all Nexxus packages. It contains model definitions, DSLs for querying and patching, configuration management, logging infrastructure, and base service classes.

**Key Responsibility:** Provide shared abstractions and utilities that ensure consistency across the entire Nexxus ecosystem.

---

## What's Inside

### 📦 Models

Built-in models with validation and serialization:

- **`Application`** - Multi-tenant app definition with schema
- **`User`** - User accounts with authentication support
- **`AppModel`** - Base class for application-specific models
- **`NexxusBaseModel`** - Abstract base for all models

**Features:**

- Schema validation
- Required field checking
- Type safety
- Serialization/deserialization

---

### 🔍 FilterQuery DSL

Database-agnostic query language for filtering data.

**Example:**

```typescript
const query = new NexxusFilterQuery({
  "$and": [
    { "status": { "$eq": "active" } },
    { "priority": { "$in": ["high", "urgent"] } }
  ]
}, { appModelDef: schema });

// Test against object
const matches = query.test({ status: "active", priority: "high" }); // true
```

**Operators:** `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$and`, `$or`

**Features:**

- Schema validation (field existence, types)
- Field-level `filterable` flag enforcement
- Nested object support (dot notation)
- Type checking based on model schema

---

### ✏️ JsonPatch (Custom Implementation)

Custom JSON Patch implementation for efficient updates.

**Differences from RFC 6902:**

- Uses `.` instead of `/` for path delimiters
- Supports multiple paths/values in single patch
- Optimized for real-time synchronization

**Example:**

```typescript
const patch = new NexxusJsonPatch({
  op: "replace",
  path: ["status", "priority"],
  value: ["completed", "low"],
  metadata: { /* ... */ }
});

// Get partial model representation
const partial = patch.getPartialModel();
// { status: "completed", priority: "low" }
```

**Operations:** `add`, `remove`, `replace`, `copy`, `move`, `test`

---

### ⚙️ Configuration Management

Hierarchical configuration with multiple providers.

**Providers:**

- **File** - JSON configuration files
- **Environment** - Environment variables
- **CLI** - Command-line arguments
- **Custom** - Extend `BaseConfigProvider` for AWS Secrets Manager, Vault, etc.

**Example:**

```typescript
const configManager = new ConfigManager([
  new FileConfigProvider('./config.json'),
  new EnvConfigProvider(),
  new CliConfigProvider()
]);

await configManager.load();
const dbConfig = configManager.get('database');
```

**Features:**

- Provider priority (later providers override earlier)
- Nested key access with dot notation
- Type-safe getters
- Async loading support

---

### 📝 Logging

Abstract logging infrastructure with pluggable implementations.

**Base Class:** `BaseLogger`

**Built-in Implementations:**

- Console logger (development)
- File logger (production)
- Custom loggers (Rollbar, Datadog, etc.)

**Example:**

```typescript
class CustomLogger extends BaseLogger {
  async initialize() { /* setup */ }
  info(message: string, label?: string) { /* log */ }
  error(message: string, label?: string) { /* log */ }
  // ... other levels
}

const logger = new CustomLogger();
await logger.initialize();
logger.info('Server started', 'API');
```

---

### 🏗️ Base Services

Abstract classes for implementing pluggable services.

**`BaseService<TConfig, TData>`**

- Generic base for all services
- Configuration management
- Data access patterns
- Lifecycle methods (initialize, start, stop)

**Example:**

```typescript
class MyDatabaseService extends BaseService<DbConfig, DbConnection> {
  async initialize() {
    // Setup connection
  }

  async start() {
    // Connect to database
  }

  async stop() {
    // Close connections
  }
}
```

---

### 📋 Type Definitions

**Model Types:**

- `NexxusModelDef` - Schema definition for app models
- `NexxusFieldDef` - Field definition (primitive, object, array)
- `PrimitiveFieldDef` - Primitive field with `filterable` flag
- `NexxusObjectFieldDef` - Nested object structure
- `NexxusArrayFieldDef` - Array field definition

**Queue Payloads:**

- `NexxusModelCreatedPayload` - Model creation event
- `NexxusModelUpdatedPayload` - Model update event (array of patches)
- `NexxusModelDeletedPayload` - Model deletion event
- `NexxusWebSocketJsonPatch` - WebSocket-specific patch (slim metadata)

**Common Types:**

- `NexxusDeviceTransportString` - Device identifier with transport (`deviceId|transport`)
- `NexxusBaseSubscriptionChannel` - Subscription channel structure
- `NexxusFilterQuery` - Filter query type

---

## Package Structure

```
src/
├── models/              # Built-in models
│   ├── Application.ts   # App definition with schema
│   ├── User.ts          # User model
│   ├── AppModel.ts      # Base for app-specific models
│   └── NexxusBaseModel.ts
│
├── common/              # Shared utilities
│   ├── FilterQuery.ts   # Query DSL
│   ├── JsonPatch.ts     # Patch operations
│   ├── QueuePayloads.ts # Message queue types
│   ├── ModelTypes.ts    # Schema type definitions
│   └── BuiltinSchemas.ts
│
├── services/            # Base service classes
│   ├── BaseService.ts   # Generic service base
│   ├── ConfigManager.ts # Configuration management
│   └── Logger.ts        # Logging infrastructure
│
└── exceptions/          # Custom exception classes
    ├── InvalidQueryFilterException.ts
    ├── InvalidModelSchemaException.ts
    └── ...
```

---

## Key Concepts

### Model Schema Definition

```typescript
const taskSchema: NexxusModelDef = {
  title: {
    type: 'string',
    required: true,
    filterable: true
  },
  status: {
    type: 'string',
    filterable: true
  },
  assignee: {
    type: 'object',
    properties: {
      email: {
        type: 'string',
        filterable: true
      },
      name: {
        type: 'string',
        filterable: false
      }
    }
  },
  tags: {
    type: 'array',
    arrayType: 'string'
  }
};
```

**Filterable Fields:**

- Must be explicitly marked with `filterable: true`
- Defaults to non-filterable if omitted
- Only available on primitive types
- Supports nested objects with dot notation

---

### Queue Payload Flow

```
API → Writer Queue
  ↓
  NexxusModelCreatedPayload / NexxusModelUpdatedPayload / NexxusModelDeletedPayload
  ↓
Writer Worker → Transport Manager Queue
  ↓
  Same payloads (with full metadata)
  ↓
Transport Manager → WebSocket Queue
  ↓
  NexxusWebSocketModelUpdatedPayload (slim metadata with channel keys)
  ↓
WebSocket Worker → Client
```

---

## Dependencies

**Runtime:**

- None (pure TypeScript, no external runtime dependencies)

**DevDependencies:**

- TypeScript
- Node.js type definitions

---

## Usage in Other Packages

**All Nexxus packages depend on Core:**

```typescript
// In @nexxus/api
import { NexxusFilterQuery, Application, User } from '@nexxus/core';

// In @nexxus/worker
import { NexxusJsonPatch, NexxusModelUpdatedPayload } from '@nexxus/core';

// In @nexxus/database
import { NexxusModelDef, BaseService } from '@nexxus/core';
```

---

## Extensibility

### Custom Config Provider

```typescript
import { BaseConfigProvider } from '@nexxus/core';

export class VaultConfigProvider extends BaseConfigProvider {
  async load(): Promise<Record<string, any>> {
    // Fetch from HashiCorp Vault
    return vaultClient.read('secret/nexxus');
  }
}
```

### Custom Logger

```typescript
import { BaseLogger } from '@nexxus/core';

export class DatadogLogger extends BaseLogger {
  async initialize() {
    // Setup Datadog client
  }

  error(message: string, label?: string) {
    // Send to Datadog
  }
}
```

---

## Status

🚧 **Work in Progress** - Types and interfaces may evolve as features are added.

---

## Related Packages

- **[@nexxus/api](../api/)** - Uses models, FilterQuery, and types
- **[@nexxus/worker](../worker/)** - Uses JsonPatch, queue payloads, and base classes
- **[@nexxus/database](../database/)** - Uses FilterQuery translation and model schemas

---

## License

MPL-2.0
