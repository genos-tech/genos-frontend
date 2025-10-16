// Legacy function mappings for backward compatibility
// These maintain the same API as the original functions

import { ActivityService } from "./services/activity.service";
import { ChatService } from "./services/chat.service";
import { FlaggedService } from "./services/flagged.service";
import { InboxService } from "./services/inbox.service";
import { NoteService } from "./services/note.service";
import { TaskService } from "./services/task.service";
import { UserService } from "./services/user.service";
import { DatabaseUtils } from "./utils/database";

/**
 * @deprecated This file is deprecated. Use the new modular structure:
 * - Use services from './services' for business logic
 * - Use repositories from './repositories' for data access
 * - Use utilities from './utils' for helper functions
 *
 * See MIGRATION_GUIDE.md for migration instructions.
 */

// Re-export from new structure for backward compatibility
export {
    ActivityService,
    ChatService,
    FlaggedService,
    InboxService,
    NoteService,
    TaskService,
    UserService,
} from "./services";
export { DatabaseUtils, ValidationUtils, HelperUtils } from "./utils";

// Create service instances for legacy compatibility
const activityService = new ActivityService();
const chatService = new ChatService();
const flaggedService = new FlaggedService();
const inboxService = new InboxService();
const noteService = new NoteService();
const taskService = new TaskService();
const userService = new UserService();

// Legacy function exports (maintains backward compatibility)
export const batchInsertMessages = async (props: any) => {
    if (props.storeName === "dmMessages") {
        return chatService.batchInsertDMMessages(props.messages);
    } else if (props.storeName === "gmMessages") {
        return chatService.batchInsertGMMessages(props.messages);
    } else if (props.storeName === "pmMessages") {
        return chatService.batchInsertPMMessages(props.messages);
    }
    return false;
};

export const miniBatchInsert = async (props: any) => {
    return batchInsertMessages(props);
};

export const addData = async (props: any) => {
    // This is a generic function that would need to be mapped to appropriate services
    console.warn("addData is deprecated. Use specific service methods instead.");
    return false;
};

export const getData = async (props: any) => {
    // This is a generic function that would need to be mapped to appropriate services
    console.warn("getData is deprecated. Use specific service methods instead.");
    return null;
};

export const getSpecificDataWithIndex = async (props: any) => {
    if (props.storeName === "dmChats") {
        return chatService.getDMChat(props.chatId);
    } else if (props.storeName === "gmChats") {
        return chatService.getGMChat(props.chatId);
    } else if (props.storeName === "pmChats") {
        return chatService.getPMChat(props.chatId);
    }
    return null;
};

export const messageIdWithChatId = async (props: any): Promise<any[]> => {
    // Handle message stores
    if (props.storeName === "dmMessages") {
        return (await chatService.getDMMessages({ chatId: props.chatId })) as any[];
    } else if (props.storeName === "gmMessages") {
        return (await chatService.getGMMessages({ chatId: props.chatId })) as any[];
    } else if (props.storeName === "pmMessages") {
        return (await chatService.getPMMessages({ chatId: props.chatId })) as any[];
    } else if (props.storeName === "dmThreadMessages") {
        return (await chatService.getDMThreadMessages(props.chatId, props.threadId)) as any[];
    } else if (props.storeName === "gmThreadMessages") {
        return (await chatService.getGMThreadMessages(props.chatId, props.threadId)) as any[];
    } else if (props.storeName === "pmThreadMessages") {
        return (await chatService.getPMThreadMessages(props.chatId, props.threadId)) as any[];
    }
    // Handle chat stores
    else if (props.storeName === "dmChats") {
        return (await chatService.getDMChats()) as any[];
    } else if (props.storeName === "gmChats") {
        return (await chatService.getGMChats()) as any[];
    } else if (props.storeName === "pmChats") {
        return (await chatService.getPMChats()) as any[];
    }
    // Handle other stores
    else if (props.storeName === "activityMessages") {
        return (await activityService.getAllActivityMessages()) as any[];
    } else if (props.storeName === "flaggedMessages") {
        return (await flaggedService.getAllFlaggedMessages()) as any[];
    } else if (props.storeName === "inbox") {
        return (await inboxService.getAllInboxItems()) as any[];
    }

    console.warn(`Unknown store name: ${props.storeName}`);
    return [];
};

export const getTeamMembers = async (teamId: string) => {
    return userService.getTeamMembers(teamId);
};

export const getProjectTasks = async (projectId: number) => {
    return taskService.getTasksByProject(projectId);
};

export const getTasksByMultipleStatus = async (projectId: number, statuses: string[]) => {
    return taskService.getTasksByMultipleStatus(projectId, statuses);
};

export const getNote = async (teamId: string) => {
    return userService.getTeamMembers(teamId);
};

export const getAllData = async (storeName: string) => {
    console.warn("getAllData is deprecated. Use specific service methods instead.");
    return [];
};

export const deleteData = async (props: any) => {
    console.warn("deleteData is deprecated. Use specific service methods instead.");
    return false;
};

export const deleteIndexedDB = async () => {
    return DatabaseUtils.deleteDatabase();
};

export const clearStore = async (storeName: string) => {
    return DatabaseUtils.clearStore(storeName);
};

export const getLatestDMChat = async () => {
    return chatService.getLatestDMChat();
};

export const getLatestGMChat = async () => {
    return chatService.getLatestGMChat();
};

export const getLatestPMChat = async () => {
    return chatService.getLatestPMChat();
};
