// Main database module exports
// This is the main entry point for the refactored database module

// Configuration
export * from "./config";

// Types
export * from "./types";

// Repositories
export * from "./repositories";

// Services
export * from "./services";

// Utilities
export * from "./utils";

// Legacy compatibility exports (for backward compatibility)
// These maintain the same API as the original files
export {
    DB_NAME,
    DB_VERSION,
    INDEX_KEY_PATHS,
    INDEX_NAMES,
    KEY_PATHS,
    STORES,
} from "./config/constants";
export { initDB } from "./config/schema";

// Convenience exports for common operations
export { ChatService } from "./services/chat.service";
export { NoteService } from "./services/note.service";
export { TaskService } from "./services/task.service";
export { UserService } from "./services/user.service";

// Utility classes
export { DatabaseUtils } from "./utils/database";
export { HelperUtils } from "./utils/helpers";
export { ValidationUtils } from "./utils/validation";
