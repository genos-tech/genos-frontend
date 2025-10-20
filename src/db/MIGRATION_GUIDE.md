# Database Module Refactoring Migration Guide

This document outlines the changes made to the database module and how to migrate from the old structure to the new one.

## Overview of Changes

The database module has been completely refactored to improve:

- **Type Safety**: Full TypeScript support with proper interfaces
- **Separation of Concerns**: Clear separation between data access, business logic, and utilities
- **Maintainability**: Modular structure with single responsibility principle
- **Testability**: Repository pattern makes unit testing easier
- **Scalability**: Easy to extend with new features

## New Structure

```
src/db/
├── config/
│   ├── constants.ts      # Database constants and store names
│   ├── schema.ts         # Database schema and initialization
│   └── index.ts          # Config exports
├── types/
│   └── index.ts          # TypeScript interfaces and types
├── repositories/
│   ├── base.ts           # Base repository class
│   ├── chat.ts           # Chat-related repositories
│   ├── user.ts           # User repository
│   ├── task.ts           # Task repository
│   ├── note.ts           # Note repository
│   └── index.ts          # Repository exports
├── services/
│   ├── chat.service.ts   # Chat business logic
│   ├── user.service.ts  # User business logic
│   ├── task.service.ts  # Task business logic
│   ├── note.service.ts  # Note business logic
│   └── index.ts         # Service exports
├── utils/
│   ├── database.ts      # Database utility functions
│   ├── validation.ts     # Data validation utilities
│   ├── helpers.ts       # General helper functions
│   └── index.ts         # Utility exports
├── index.ts             # Main module exports
└── MIGRATION_GUIDE.md   # This file
```

## Migration Examples

### Before (Old Structure)

```typescript
import { openDB } from "idb";

import { DB_NAME, DB_VERSION, STORES } from "./db/conf";
import { initDB } from "./db/schema";

// Direct database operations
const db = await openDB(DB_NAME, DB_VERSION);
const messages = await db.getAll(STORES.DM_MESSAGES);
```

### After (New Structure)

```typescript
import { ChatService } from "./db";

// Service-based operations
const chatService = new ChatService();
const messages = await chatService.getDMMessages({ chatId: 123 });
```

## Key Changes

### 1. Configuration

- **Before**: All constants in `conf.ts`
- **After**: Organized in `config/constants.ts` and `config/schema.ts`

### 2. Data Access

- **Before**: Direct IndexedDB operations scattered throughout
- **After**: Repository pattern with `BaseRepository` and specific repositories

### 3. Business Logic

- **Before**: Mixed with data access in `crud.ts`
- **After**: Separate service layer with clear business logic

### 4. Type Safety

- **Before**: Using `any` types extensively
- **After**: Full TypeScript interfaces and type checking

### 5. Utilities

- **Before**: Mixed utility functions in `utils.ts`
- **After**: Organized utility classes by purpose

## Migration Steps

### Step 1: Update Imports

Replace old imports with new ones:

```typescript
// Old
import { DB_NAME, DB_VERSION, STORES } from "./db/conf";
import { addData, getAllData } from "./db/crud";
import { initDB } from "./db/schema";

// New
import {
    ChatService,
    DB_NAME,
    DB_VERSION,
    initDB,
    NoteService,
    STORES,
    TaskService,
    UserService,
} from "./db";
```

### Step 2: Replace Direct Database Operations

Replace direct IndexedDB calls with service methods:

```typescript
// Old
const db = await openDB(DB_NAME, DB_VERSION);
const messages = await db.getAll(STORES.DM_MESSAGES);

// New
const chatService = new ChatService();
const messages = await chatService.getDMMessages({ chatId: 123 });
```

### Step 3: Use Type Safety

Replace `any` types with proper interfaces:

```typescript
// New
import { ChatMessage } from "./db";

// Old
function processMessage(message: any) {
    // ...
}

function processMessage(message: ChatMessage) {
    // ...
}
```

### Step 4: Use Validation

Add data validation where needed:

```typescript
import { ValidationUtils } from "./db";

if (ValidationUtils.isValidChatMessage(message)) {
    // Process valid message
}
```

## Backward Compatibility

The new structure maintains backward compatibility through:

- Legacy exports in the main `index.ts`
- Same function names where possible
- Gradual migration support

## Benefits of New Structure

1. **Type Safety**: Catch errors at compile time
2. **Maintainability**: Clear separation of concerns
3. **Testability**: Easy to mock repositories and services
4. **Scalability**: Easy to add new features
5. **Documentation**: Self-documenting code with interfaces
6. **Performance**: Optimized database operations
7. **Error Handling**: Consistent error handling patterns

## Common Patterns

### Getting Data

```typescript
// Old
const data = await getAllData(storeName);

// New
const service = new ChatService(); // or appropriate service
const data = await service.getDMMessages({ chatId: 123 });
```

### Adding Data

```typescript
// Old
await addData({ storeName, data });

// New
const service = new ChatService();
await service.addDMMessage(message);
```

### Batch Operations

```typescript
// Old
await batchInsertMessages({ storeName, messages });

// New
const service = new ChatService();
await service.batchInsertDMMessages(messages);
```

## Testing

The new structure makes testing much easier:

```typescript
// Mock repositories for testing
const mockChatRepo = {
    getChat: jest.fn(),
    getAllChats: jest.fn(),
    // ... other methods
};

const chatService = new ChatService();
// Inject mock repository for testing
```

## Performance Considerations

- Repository pattern adds minimal overhead
- Service layer provides caching opportunities
- Type checking has no runtime impact
- Better error handling prevents crashes

## Next Steps

1. Update all imports to use the new structure
2. Replace direct database operations with service calls
3. Add proper TypeScript types
4. Write tests for new services
5. Remove old files once migration is complete
