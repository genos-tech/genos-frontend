import { UserProps } from "../../types/admin";
import { AllChatProps, MessageProps, ThreadMessageProps } from "../../types/chat";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import { TaskTableProps } from "../../types/tasks";

// Validation utility functions
export class ValidationUtils {
    // Validate chat object
    static isValidChat(chat: any): chat is AllChatProps {
        return (
            chat &&
            typeof chat.chatId === "number" &&
            typeof chat.name === "string" &&
            ["dm", "gm", "pm"].includes(chat.type) &&
            Array.isArray(chat.participants)
        );
    }

    // Validate chat message object
    static isValidChatMessage(message: any): message is MessageProps {
        return (
            message &&
            typeof message.messageIdWithChatId === "string" &&
            typeof message.chatId === "number" &&
            typeof message.messageId === "number" &&
            typeof message.content === "string" &&
            typeof message.timestamp === "number" &&
            typeof message.userId === "string"
        );
    }

    // Validate thread message object
    static isValidThreadMessage(message: any): message is ThreadMessageProps {
        return (
            message &&
            typeof message.messageIdWithChatIdAndThreadId === "string" &&
            typeof message.chatId === "number" &&
            typeof message.threadId === "number" &&
            typeof message.messageId === "number" &&
            typeof message.content === "string" &&
            typeof message.timestamp === "number" &&
            typeof message.userId === "string"
        );
    }

    // Validate user object
    static isValidUser(user: any): user is UserProps {
        return (
            user &&
            typeof user.userId === "string" &&
            typeof user.userName === "string" &&
            typeof user.teamId === "string"
        );
    }

    // Validate task object
    static isValidTask(task: any): task is TaskTableProps {
        return (
            task &&
            typeof task.id === "number" &&
            typeof task.projectId === "number" &&
            typeof task.title === "string" &&
            typeof task.status === "string" &&
            typeof task.createdAt === "number" &&
            typeof task.updatedAt === "number"
        );
    }

    // Validate note object
    static isValidNote(note: any): note is MyNoteProps | TaskNoteProps | ChatNoteProps {
        return (
            note &&
            typeof note.noteId === "number" &&
            typeof note.title === "string" &&
            typeof note.content === "string" &&
            ["personal", "task", "chat"].includes(note.type) &&
            typeof note.createdAt === "number" &&
            typeof note.updatedAt === "number" &&
            typeof note.userId === "string"
        );
    }

    // Validate chat ID
    static isValidChatId(chatId: any): chatId is number {
        return typeof chatId === "number" && chatId > 0;
    }

    // Validate user ID
    static isValidUserId(userId: any): userId is string {
        return typeof userId === "string" && userId.length > 0;
    }

    // Validate task ID
    static isValidTaskId(taskId: any): taskId is number {
        return typeof taskId === "number" && taskId > 0;
    }

    // Validate note ID
    static isValidNoteId(noteId: any): noteId is number {
        return typeof noteId === "number" && noteId > 0;
    }

    // Validate project ID
    static isValidProjectId(projectId: any): projectId is number {
        return typeof projectId === "number" && projectId > 0;
    }

    // Validate team ID
    static isValidTeamId(teamId: any): teamId is string {
        return typeof teamId === "string" && teamId.length > 0;
    }

    // Validate email format
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate timestamp
    static isValidTimestamp(timestamp: any): timestamp is number {
        return typeof timestamp === "number" && timestamp > 0;
    }

    // Sanitize string input
    static sanitizeString(input: string): string {
        return input.trim().replace(/[<>]/g, "");
    }

    // Validate array of items
    static validateArray<T>(items: any[], validator: (item: any) => item is T): T[] {
        return items.filter(validator);
    }
}
