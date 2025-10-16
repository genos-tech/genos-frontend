// Import props types from the main types
import { UserProps } from "../../types/admin";
import { ActivityMessageProps, AllChatProps, FlaggedMessageProps } from "../../types/chat";
import { InboxItemProps } from "../../types/common";

// Database types and interfaces
export interface DatabaseConfig {
    name: string;
    version: number;
}

export interface StoreConfig {
    name: string;
    keyPath: string;
    indexes?: IndexConfig[];
}

export interface IndexConfig {
    name: string;
    keyPath: string | string[];
    unique?: boolean;
}

export interface ChatMessage {
    messageIdWithChatId: string;
    chatId: number;
    messageId: number;
    content: string;
    timestamp: number;
    userId: string;
    userName?: string;
}

export interface ThreadMessage {
    messageIdWithChatIdAndThreadId: string;
    chatId: number;
    threadId: number;
    messageId: number;
    content: string;
    timestamp: number;
    userId: string;
    userName?: string;
}

// Use the props types as the database types
export type Chat = AllChatProps;
export type User = UserProps;
export type ActivityMessage = ActivityMessageProps;
export type FlaggedMessage = FlaggedMessageProps;
export type InboxItem = InboxItemProps;

export interface Task {
    id: number;
    projectId: number;
    title: string;
    description?: string;
    status: string;
    assigneeId?: string;
    createdAt: number;
    updatedAt: number;
}

export interface Note {
    noteId: number;
    title: string;
    content: string;
    type: "personal" | "task" | "chat";
    createdAt: number;
    updatedAt: number;
    userId: string;
    relatedId?: number; // taskId, chatId, etc.
}

// Operation result types
export interface OperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

export interface BatchOperationResult {
    success: boolean;
    inserted: number;
    errors: string[];
}

// Query parameters
export interface MessageQuery {
    chatId: number;
    threadId?: number;
    limit?: number;
    offset?: number;
}

export interface TaskQuery {
    projectId: number;
    status?: string | string[];
    assigneeId?: string;
}

export interface NoteQuery {
    type: "personal" | "task" | "chat";
    userId: string;
    relatedId?: number;
}
