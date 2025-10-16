// Legacy function mappings for backward compatibility
import { DatabaseUtils } from "./utils/database";

/**
 * @deprecated This file is deprecated. Use the new modular structure:
 * - Use utilities from './utils' for helper functions
 * - Use services from './services' for business logic
 *
 * See MIGRATION_GUIDE.md for migration instructions.
 */

// Re-export from new structure for backward compatibility
export { DatabaseUtils } from "./utils/database";
export { ValidationUtils } from "./utils/validation";
export { HelperUtils } from "./utils/helpers";

export async function getAllStores(dbName: string): Promise<string[]> {
    return DatabaseUtils.getAllStores(dbName);
}

export async function checkNoteExists(storeName: string, noteId: number): Promise<boolean> {
    console.warn("checkNoteExists is deprecated. Use NoteService instead.");
    return false;
}

export async function checkIsKnownDMChat(chatId: number): Promise<boolean> {
    console.warn("checkIsKnownDMChat is deprecated. Use ChatService.isKnownDMChat instead.");
    return false;
}

export async function checkIsKnownGMChat(chatId: number): Promise<boolean> {
    console.warn("checkIsKnownGMChat is deprecated. Use ChatService.isKnownGMChat instead.");
    return false;
}

export async function checkIsKnownPMChat(chatId: number): Promise<boolean> {
    console.warn("checkIsKnownPMChat is deprecated. Use ChatService.isKnownPMChat instead.");
    return false;
}
