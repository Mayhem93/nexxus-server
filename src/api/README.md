# @mayhem93/nexxus-api

> REST API server for Nexxus - Authentication, device management, subscriptions, and model operations

---

## Overview

The **API package** is the main entry point for client applications interacting with Nexxus. It provides RESTful endpoints for user authentication, device registration, subscription management, and CRUD operations on application models.

**Key Responsibility:** Validate requests and queue operations to worker pipeline (does not write app models directly to database).

---

## Features

### 🔐 Authentication

- **Local Strategy:** Username/password with JWT tokens
- **OAuth:** Google authentication
- **Optional Mode:** Disable authentication for development/testing
- **Device-specific Tokens:** Each device gets unique JWT for security

### 📱 Device Management

- Register devices for receiving real-time updates
- Device information and status tracking
- Multi-device support per user

### 📡 Subscription Management

- Subscribe to channels (filtered or unfiltered)
- Unsubscribe from channels
- List active subscriptions per device

### 📦 Model Operations (CRUD)

- **Create:** Queue model creation to Writer Worker
- **Read:** Direct database queries with FilterQuery support
- **Update:** Queue updates (JsonPatch) to Writer Worker
- **Delete:** Queue deletion to Writer Worker

**Important:** App model writes are **queued**, not executed directly. Only User model writes happen immediately.

---

## Architecture

```
Client Request
      ↓
   API Server (Express)
      ↓
   ┌──────────────────────┐
   │  Authentication      │ → JWT validation
   │  Request Validation  │ → Schema checking
   └──────────────────────┘
      ↓
   ┌──────────────────────┐
   │  Route Handlers      │
   │  - /user/*           │ → Direct DB writes
   │  - /device/*         │ → Redis operations
   │  - /subscription/*   │ → Redis operations
   │  - /model/:type      │ → Queue to Writer
   └──────────────────────┘
      ↓
   Message Queue (RabbitMQ)
      ↓
   Writer Worker (processes queued operations)
```

---

## Routes

### User Endpoints

- `POST /user/register` - Create new user account
- `POST /user/login` - Authenticate and get JWT token
- `GET /user/profile` - Get current user information
- `PATCH /user/profile` - Update user profile
- `DELETE /user/account` - Delete user account

### Device Endpoints

- `POST /device/register` - Register device for push notifications
- `GET /device/:deviceId` - Get device information
- `DELETE /device/:deviceId` - Unregister device

### Subscription Endpoints

- `POST /subscription` - Subscribe to a channel
- `DELETE /subscription/:subscriptionId` - Unsubscribe from channel
- `GET /subscription/device/:deviceId` - List device subscriptions

### Model Endpoints

- `POST /model/:type` - Create model instance (queued)
- `GET /model/:type` - Search/query model instances
- `GET /model/:type/:id` - Get specific model instance
- `PATCH /model/:type/:id` - Update model instance (queued, JsonPatch)
- `DELETE /model/:type/:id` - Delete model instance (queued)

---

## Configuration

```typescript
{
  api: {
    port: 3000,
    auth: {
      enabled: true,
      strategies: ['local', 'google'],
      jwt: {
        secret: 'your-secret-key',
        expiresIn: '7d'
      },
      google: {
        clientId: 'your-google-client-id',
        clientSecret: 'your-google-client-secret',
        callbackURL: 'http://localhost:3000/auth/google/callback'
      }
    }
  }
}
```

---

## Dependencies

- **Express** - HTTP server framework
- **Passport** - Authentication middleware
- **jsonwebtoken** - JWT token generation/validation
- **@mayhem93/nexxus-core** - Shared models, types, FilterQuery
- **@mayhem93/nexxus-database** - Database operations
- **@mayhem93/nexxus-message-queue** - Queue operations to workers
- **@mayhem93/nexxus-redis** - Device and subscription storage

---

## Status

🚧 **Work in Progress** - API surface may change as the project evolves.

---

## Related Packages

- **[@mayhem93/nexxus-worker](../worker/)** - Processes queued operations from API
- **[@mayhem93/nexxus-core](../core/)** - Shared types and models
- **[@mayhem93/nexxus-database](../database/)** - Database abstraction layer

---

## License

MPL-2.0
