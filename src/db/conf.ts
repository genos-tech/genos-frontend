/**
 * @deprecated This file is deprecated. Use the new modular structure:
 * - Import from './config/constants' for constants
 * - Import from './config/schema' for schema initialization
 * - Use services from './services' for business logic
 *
 * See MIGRATION_GUIDE.md for migration instructions.
 */

// Re-export from new structure for backward compatibility
export {
    DB_NAME,
    DB_VERSION,
    STORES,
    KEY_PATHS as KEY_PATH,
    INDEX_NAMES as INDEX,
    INDEX_KEY_PATHS as INDEX_KEY,
} from "./config/constants";
