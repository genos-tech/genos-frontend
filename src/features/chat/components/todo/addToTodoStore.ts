import { useSyncExternalStore } from "react";

import type { MessageProps, ThreadMessageProps } from "../../../../types/chat";
import type { TaskCommentProps } from "../../../../types/tasks";

/**
 * "Put this message on my To-Do list" as a request any page can make (MIP-1434).
 *
 * The request used to be a `useState` in ChatHome, handed down through six components, so only
 * the chat page could make one: double-clicking a task comment on the task page, in the task
 * modal or in a note preview did nothing. A bubble now calls `setTodoFromMessageBubble` from
 * wherever it is; `AddToTodoHost` (mounted once in App) does the work. Same shape as the toast
 * store: a module-level value, subscribed to.
 */
export type TodoSource = MessageProps | ThreadMessageProps | TaskCommentProps;

let pending: TodoSource | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

/** Ask for a to-do from this message (`null` clears the request once it is handled). */
export const setTodoFromMessageBubble = (next: TodoSource | null): void => {
    pending = next;
    listeners.forEach((listener) => listener());
};

/** The request waiting to be handled, if any. */
export const useTodoFromMessageBubble = (): TodoSource | null =>
    useSyncExternalStore(
        subscribe,
        () => pending,
        () => null
    );
