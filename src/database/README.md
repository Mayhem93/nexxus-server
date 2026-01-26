# @nexxus/database

> Database abstraction layer for Nexxus - Pluggable adapters for different database systems

---

## Overview

The **Database package** provides a unified interface for data persistence across different database systems. It comes with a built-in Elasticsearch adapter and allows developers to implement adapters for any database of their choice.

**Key Responsibility:** Abstract database operations (CRUD, search, bulk operations) behind a consistent API while translating Nexxus-specific constructs (FilterQuery, JsonPatch) into native database queries.

---

## Features

### 🔌 Pluggable Architecture

- Built-in **Elasticsearch** adapter
- Extend `DatabaseAdapter` for other databases (PostgreSQL, MongoDB, etc.)
- Consistent API regardless of underlying database

### 🔍 Query Translation

- Converts `FilterQuery` DSL to native database queries
- Database-agnostic filtering logic
- Support for complex nested queries (`$and`, `$or`, operators)

### ✏️ Update Operations

- JsonPatch to database update translation
- Bulk update support with scripted operations
- Partial field returns (dot notation support)

### 📦 Bulk Operations

- Batch create, update, delete for performance
- Transaction-like semantics where supported
- Efficient bulk indexing

---

## Architecture

```
Application Code
      ↓
DatabaseAdapter (Abstract)
      ↓
   ┌──────────────────────────────┐
   │  ElasticsearchAdapter        │ (Built-in)
   │  PostgresAdapter             │ (Custom)
   │  MongoDBAdapter              │ (Custom)
   │  Neo4jAdapter                │ (Custom)
   └──────────────────────────────┘
      ↓
Underlying Database
```

---

## Built-in Adapter: Elasticsearch

### Why Elasticsearch?

- **Full-text search** capabilities
- **Scalable** horizontal scaling
- **JSON-native** document storage
- **Real-time indexing** for instant queries
- **Aggregations** for analytics

### Features

- Single-node and cluster support
- Index management with settings/mappings
- Bulk operations with error handling
- Script-based updates for nested fields
- Source filtering for partial returns

---

## Core Operations

### Create

```typescript
await database.createItem({
  index: 'tasks',
  item: {
    id: 'task-123',
    title: 'Implement feature',
    status: 'todo',
    assignee: { email: 'dev@example.com' }
  },
  returnFields: ['id', 'title', 'createdAt']
});
```

### Read

```typescript
// Get by ID
const task = await database.getItem({
  index: 'tasks',
  id: 'task-123'
});

// Get multiple
const tasks = await database.getItems({
  index: 'tasks',
  ids: ['task-123', 'task-456']
});
```

### Search

```typescript
const results = await database.searchItems({
  index: 'tasks',
  filters: new NexxusFilterQuery({
    "$and": [
      { "status": { "$eq": "todo" } },
      { "assignee.email": { "$eq": "dev@example.com" } }
    ]
  }),
  sort: [{ field: 'createdAt', order: 'desc' }],
  limit: 20,
  offset: 0
});
```

### Update

```typescript
// Single update with JsonPatch
await database.updateItem({
  index: 'tasks',
  id: 'task-123',
  item: new NexxusJsonPatch({
    op: 'replace',
    path: ['status'],
    value: ['completed'],
    metadata: { /* ... */ }
  }),
  returnFields: ['status', 'updatedAt']
});
```

### Bulk Update

```typescript
// Update multiple items with different patches
await database.updateItems({
  index: 'tasks',
  items: [
    {
      id: 'task-123',
      item: patch1
    },
    {
      id: 'task-456',
      item: patch2
    }
  ],
  returnFields: ['status', 'updatedAt']
});
```

### Delete

```typescript
// Single delete
await database.deleteItem({
  index: 'tasks',
  id: 'task-123'
});

// Bulk delete
await database.deleteItems({
  index: 'tasks',
  ids: ['task-123', 'task-456', 'task-789']
});
```

---

## FilterQuery Translation

### Input (FilterQuery DSL)

```typescript
{
  "$and": [
    { "status": { "$in": ["todo", "in_progress"] } },
    { "priority": { "$gte": 5 } },
    { "$or": [
      { "assignee.email": { "$eq": "dev@example.com" } },
      { "team": { "$eq": "backend" } }
    ]}
  ]
}
```

### Output (Elasticsearch Query)

```json
{
  "bool": {
    "must": [
      { "terms": { "status": ["todo", "in_progress"] } },
      { "range": { "priority": { "gte": 5 } } },
      {
        "bool": {
          "should": [
            { "term": { "assignee.email": "dev@example.com" } },
            { "term": { "team": "backend" } }
          ]
        }
      }
    ]
  }
}
```

---

## JsonPatch Translation

### Input (JsonPatch)

```typescript
{
  op: "replace",
  path: ["status", "assignee.email"],
  value: ["completed", "new-dev@example.com"]
}
```

### Output (Elasticsearch Script)

```javascript
ctx._source.status = params.status;
ctx._source.assignee.email = params.assignee_email;
```

**Features:**

- Handles nested object updates
- Dot notation to nested structure conversion
- Validation of paths against schema
- Safe parameter binding (prevents injection)

---

## Custom Adapter Implementation

### Step 1: Extend DatabaseAdapter

```typescript
import { DatabaseAdapter } from '@nexxus/database';

export class PostgresDatabaseAdapter extends DatabaseAdapter {
  private pool: pg.Pool;

  async connect(config: any) {
    this.pool = new pg.Pool(config);
  }

  async disconnect() {
    await this.pool.end();
  }

  async createItem(options: NexxusDbCreateOptions) {
    const query = `
      INSERT INTO ${options.index} (data)
      VALUES ($1)
      RETURNING *
    `;
    const result = await this.pool.query(query, [JSON.stringify(options.item)]);
    return result.rows[0];
  }

  async searchItems(options: NexxusDbSearchOptions) {
    // Translate FilterQuery to SQL WHERE clause
    const whereClause = this.filterQueryToSQL(options.filters);
    const query = `
      SELECT * FROM ${options.index}
      WHERE ${whereClause}
      LIMIT ${options.limit}
      OFFSET ${options.offset}
    `;
    const result = await this.pool.query(query);
    return result.rows;
  }

  private filterQueryToSQL(filter: NexxusFilterQuery): string {
    // Convert FilterQuery DSL to SQL
    // Example: { "status": { "$eq": "active" } } → "status = 'active'"
  }

  // Implement other abstract methods...
}
```

### Step 2: Register Adapter

```typescript
const database = new PostgresDatabaseAdapter();
await database.connect({
  host: 'localhost',
  port: 5432,
  database: 'nexxus'
});
```

---

## Configuration

### Elasticsearch (Built-in)

```typescript
{
  database: {
    adapter: "elasticsearch",
    nodes: ["http://localhost:9200"],
    auth: {
      username: "elastic",
      password: "changeme"
    },
    tls: {
      rejectUnauthorized: false
    }
  }
}
```

### Custom Adapter

```typescript
{
  database: {
    adapter: new PostgresDatabaseAdapter(),
    config: {
      host: "localhost",
      port: 5432,
      database: "nexxus",
      user: "nexxus_user",
      password: "secret"
    }
  }
}
```

---

## Package Structure

```
src/
├── lib/
│   ├── ElasticsearchDb.ts      # Built-in Elasticsearch adapter
│   ├── DatabaseAdapter.ts      # Abstract base class
│   └── DatabaseService.ts      # Service wrapper
│
└── index.ts                    # Public exports
```

---

## Key Classes

### `DatabaseAdapter` (Abstract)

Base class for all database adapters.

**Abstract Methods:**

- `connect(config: any): Promise<void>`
- `disconnect(): Promise<void>`
- `createItem(options: NexxusDbCreateOptions): Promise<T>`
- `getItem(options: NexxusDbGetOptions): Promise<T>`
- `getItems(options: NexxusDbGetItemsOptions): Promise<T[]>`
- `searchItems(options: NexxusDbSearchOptions): Promise<T[]>`
- `updateItem(options: NexxusDbUpdateOptions): Promise<Partial<T>>`
- `updateItems(options: NexxusDbUpdateItemsOptions): Promise<Partial<T>[]>`
- `deleteItem(options: NexxusDbDeleteOptions): Promise<void>`
- `deleteItems(options: NexxusDbDeleteItemsOptions): Promise<void>`

### `NexxusElasticsearchDb`

Elasticsearch implementation of `DatabaseAdapter`.

**Features:**

- Index management (create, delete, exists)
- Bulk operations (create, update, delete)
- Script-based updates for nested fields
- Source filtering with dot notation
- Error handling with detailed logging

---

## Dependencies

**Runtime:**

- `@elastic/elasticsearch` (built-in adapter)
- `@nexxus/core` (FilterQuery, JsonPatch, models)

**DevDependencies:**

- TypeScript
- Node.js type definitions

---

## Usage in Other Packages

```typescript
// In @nexxus/api
import { DatabaseAdapter } from '@nexxus/database';

const results = await database.searchItems({
  index: 'tasks',
  filters: new NexxusFilterQuery({ /* ... */ })
});

// In @nexxus/worker
import { NexxusElasticsearchDb } from '@nexxus/database';

const db = new NexxusElasticsearchDb();
await db.connect(config);
await db.createItem({ /* ... */ });
```

---

## Adapter Examples

### PostgreSQL (Relational)

```typescript
class PostgresDatabaseAdapter extends DatabaseAdapter {
  // Store models as JSONB columns
  // Translate FilterQuery to SQL WHERE clauses
  // Use JSON path operators for nested queries
}
```

### MongoDB (Document)

```typescript
class MongoDBAdapter extends DatabaseAdapter {
  // Native document storage (similar to Elasticsearch)
  // FilterQuery maps cleanly to MongoDB query operators
  // JsonPatch to MongoDB update operators
}
```

### Neo4j (Graph)

```typescript
class Neo4jAdapter extends DatabaseAdapter {
  // Store models as nodes with properties
  // FilterQuery to Cypher WHERE clauses
  // Relationships for nested objects
}
```

---

## Performance Considerations

### Bulk Operations

- Use bulk operations for multiple items (10-100x faster)
- Elasticsearch bulk API processes 1000+ docs/second
- Batching reduces network overhead

### Indexing

- Elasticsearch refresh interval affects write performance
- Configure index settings per use case (real-time vs. throughput)
- Use index templates for consistent settings

### Query Optimization

- Use FilterQuery validation to catch errors early
- Leverage database-specific optimizations (indices, caching)
- Return only needed fields with `returnFields`

---

## Status

🚧 **Work in Progress** - Additional adapters and optimizations planned.

**Coming Soon:**

- Connection pooling configuration
- Transaction support (where applicable)
- Query result caching
- Database-specific optimizations

---

## Related Packages

- **[@nexxus/core](../core/)** - FilterQuery, JsonPatch, model definitions
- **[@nexxus/api](../api/)** - Uses database for reads and queued writes
- **[@nexxus/worker](../worker/)** - Writer worker persists to database

---

## License

MPL-2.0
