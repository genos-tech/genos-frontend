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
    chatType: number;
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
    noteType: number;
    userId: string;
    relatedId?: number;
}
