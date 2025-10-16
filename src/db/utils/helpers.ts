import { ChatMessage, Note, ThreadMessage } from "../types";

// Helper utility functions
export class HelperUtils {
    // Generate unique message ID with chat ID
    static generateMessageIdWithChatId(chatId: number, messageId: number): string {
        return `${chatId}_${messageId}`;
    }

    // Generate unique thread message ID
    static generateThreadMessageId(chatId: number, threadId: number, messageId: number): string {
        return `${chatId}_${threadId}_${messageId}`;
    }

    // Generate unique flagged message ID
    static generateFlaggedMessageId(messageId: string, chatId: number): string {
        return `flagged_${chatId}_${messageId}`;
    }

    // Generate unique activity message ID
    static generateActivityMessageId(type: string, timestamp: number): string {
        return `activity_${type}_${timestamp}`;
    }

    // Generate unique inbox item ID
    static generateInboxItemId(type: string, timestamp: number): string {
        return `inbox_${type}_${timestamp}`;
    }

    // Sort messages by timestamp
    static sortMessagesByTimestamp<T extends { timestamp: number }>(messages: T[]): T[] {
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    }

    // Sort messages by timestamp (newest first)
    static sortMessagesByTimestampDesc<T extends { timestamp: number }>(messages: T[]): T[] {
        return messages.sort((a, b) => b.timestamp - a.timestamp);
    }

    // Get latest message from array
    static getLatestMessage<T extends { timestamp: number }>(messages: T[]): T | null {
        if (messages.length === 0) return null;
        return messages.reduce((latest, current) =>
            current.timestamp > latest.timestamp ? current : latest
        );
    }

    // Get oldest message from array
    static getOldestMessage<T extends { timestamp: number }>(messages: T[]): T | null {
        if (messages.length === 0) return null;
        return messages.reduce((oldest, current) =>
            current.timestamp < oldest.timestamp ? current : oldest
        );
    }

    // Filter messages by date range
    static filterMessagesByDateRange<T extends { timestamp: number }>(
        messages: T[],
        startDate: number,
        endDate: number
    ): T[] {
        return messages.filter(
            (message) => message.timestamp >= startDate && message.timestamp <= endDate
        );
    }

    // Paginate messages
    static paginateMessages<T>(messages: T[], page: number, pageSize: number): T[] {
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return messages.slice(startIndex, endIndex);
    }

    // Get total pages for pagination
    static getTotalPages(totalItems: number, pageSize: number): number {
        return Math.ceil(totalItems / pageSize);
    }

    // Format timestamp to readable date
    static formatTimestamp(timestamp: number): string {
        return new Date(timestamp).toLocaleString();
    }

    // Get relative time (e.g., "2 hours ago")
    static getRelativeTime(timestamp: number): string {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
        return "Just now";
    }

    // Debounce function
    static debounce<T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): (...args: Parameters<T>) => void {
        let timeout: NodeJS.Timeout;
        return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    // Throttle function
    static throttle<T extends (...args: any[]) => any>(
        func: T,
        limit: number
    ): (...args: Parameters<T>) => void {
        let inThrottle: boolean;
        return (...args: Parameters<T>) => {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    // Deep clone object
    static deepClone<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }

    // Check if object is empty
    static isEmpty(obj: any): boolean {
        return Object.keys(obj).length === 0;
    }

    // Generate random ID
    static generateRandomId(): string {
        return Math.random().toString(36).substr(2, 9);
    }

    // Generate UUID v4
    static generateUUID(): string {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }

    // Calculate text similarity (simple)
    static calculateSimilarity(text1: string, text2: string): number {
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;

        if (longer.length === 0) return 1.0;

        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    // Levenshtein distance calculation
    private static levenshteinDistance(str1: string, str2: string): number {
        const matrix = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    }
}
