import { UserProps } from "../../types/admin";
import { AllChatProps, MessageProps, ThreadMessageProps } from "../../types/chat";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../types/notes";
import { TaskTableProps } from "../../types/tasks";

// Validation utility functions
export class ValidationUtils {
    // Validate chat object
    static isValidChat(value: unknown): value is AllChatProps {
        const chat = value as Record<string, unknown> | null | undefined;
        return (
            !!chat &&
            typeof chat.chatId === "number" &&
            typeof chat.name === "string" &&
            ["dm", "gm", "pm"].includes(chat.type as string) &&
            Array.isArray(chat.participants)
        );
    }

    // Validate chat message object
    static isValidChatMessage(value: unknown): value is MessageProps {
        const message = value as Record<string, unknown> | null | undefined;
        return (
            !!message &&
            typeof message.messageIdWithChatId === "string" &&
            typeof message.chatId === "number" &&
            typeof message.messageId === "number" &&
            typeof message.content === "string" &&
            typeof message.timestamp === "number" &&
            typeof message.userId === "string"
        );
    }

    // Validate thread message object
    static isValidThreadMessage(value: unknown): value is ThreadMessageProps {
        const message = value as Record<string, unknown> | null | undefined;
        return (
            !!message &&
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
    static isValidUser(value: unknown): value is UserProps {
        const user = value as Record<string, unknown> | null | undefined;
        return (
            !!user &&
            typeof user.userId === "string" &&
            typeof user.userName === "string" &&
            typeof user.teamId === "string"
        );
    }

    // Validate task object
    static isValidTask(value: unknown): value is TaskTableProps {
        const task = value as Record<string, unknown> | null | undefined;
        return (
            !!task &&
            typeof task.id === "number" &&
            typeof task.projectId === "number" &&
            typeof task.title === "string" &&
            typeof task.status === "string" &&
            typeof task.createdAt === "number" &&
            typeof task.updatedAt === "number"
        );
    }

    // Validate note object
    static isValidNote(value: unknown): value is MyNoteProps | TaskNoteProps | ChatNoteProps {
        const note = value as Record<string, unknown> | null | undefined;
        return (
            !!note &&
            typeof note.noteId === "number" &&
            typeof note.title === "string" &&
            typeof note.content === "string" &&
            ["personal", "task", "chat"].includes(note.type as string) &&
            typeof note.createdAt === "number" &&
            typeof note.updatedAt === "number" &&
            typeof note.userId === "string"
        );
    }

    // Validate chat ID
    static isValidChatId(chatId: unknown): chatId is number {
        return typeof chatId === "number" && chatId > 0;
    }

    // Validate user ID
    static isValidUserId(userId: unknown): userId is string {
        return typeof userId === "string" && userId.length > 0;
    }

    // Validate task ID
    static isValidTaskId(taskId: unknown): taskId is number {
        return typeof taskId === "number" && taskId > 0;
    }

    // Validate note ID
    static isValidNoteId(noteId: unknown): noteId is number {
        return typeof noteId === "number" && noteId > 0;
    }

    // Validate project ID
    static isValidProjectId(projectId: unknown): projectId is number {
        return typeof projectId === "number" && projectId > 0;
    }

    // Validate team ID
    static isValidTeamId(teamId: unknown): teamId is string {
        return typeof teamId === "string" && teamId.length > 0;
    }

    // Validate email format
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate timestamp
    static isValidTimestamp(timestamp: unknown): timestamp is number {
        return typeof timestamp === "number" && timestamp > 0;
    }

    // Sanitize string input
    static sanitizeString(input: string): string {
        return input.trim().replace(/[<>]/g, "");
    }

    // Validate array of items
    static validateArray<T>(items: unknown[], validator: (item: unknown) => item is T): T[] {
        return items.filter(validator);
    }
}
