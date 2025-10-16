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
export { initDB } from "./config/schema";
export {
    DB_NAME,
    DB_VERSION,
    STORES,
    KEY_PATHS,
    INDEX_NAMES,
    INDEX_KEY_PATHS,
} from "./config/constants";

// Convenience exports for common operations
export { ChatService } from "./services/chat.service";
export { UserService } from "./services/user.service";
export { TaskService } from "./services/task.service";
export { NoteService } from "./services/note.service";

// Utility classes
export { DatabaseUtils } from "./utils/database";
export { ValidationUtils } from "./utils/validation";
export { HelperUtils } from "./utils/helpers";
