/**
 * @deprecated This file is deprecated. Use the new modular structure:
 * - Import from './config/schema' for schema initialization
 * - Use services from './services' for business logic
 *
 * See MIGRATION_GUIDE.md for migration instructions.
 */

// Re-export from new structure for backward compatibility
export { initDB } from "./config/schema";
