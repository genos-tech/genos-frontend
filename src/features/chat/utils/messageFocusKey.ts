/**
 * Resolve a URL `/message/:id` segment to the key a message list focuses on.
 *
 * The list keys focus and scroll on the bare v3 `Message.id` UUID — the
 * bubble's `messageIdWithChatId` (`…AndThreadId` in a thread), read by
 * `MessageListRenderer.resolveFocusedState` and `useScrollManagement` via
 * `moveToSpecificIndex`. URLs don't carry that UUID in every case, so the
 * segment has to be translated, and two shapes reach these URLs:
 *
 *   - the per-channel numeric `seq` — what the in-app "Copy link to
 *     message" builds, and what a reminder's inbox card / web-push link
 *     carries;
 *   - a v3 UUID — what Spotlight results and answer citations build.
 *
 * The pre-v3 composite keys (`{chatId}-{messageId}`,
 * `{chatId}-{threadId}-{messageId}`) match nothing now. Synthesizing one
 * is worse than returning `undefined`: `useScrollManagement` keeps an
 * unresolved target alive and retries it as more rows page in, so a key
 * that can never match leaves the pane waiting forever — and it won't
 * fall back to the bottom of the chat either, since a target being set is
 * what suppresses that.
 */

import type { MessageProps, ThreadMessageProps } from "../../../types/chat";

/** A `/message/:id` URL segment: a numeric `seq` or a v3 UUID. */
export type MessageRef = number | string;

const isUuidRef = (ref: MessageRef): ref is string =>
    typeof ref === "string" && !/^\d+$/.test(ref);

/** The v3 UUID to focus in a main channel, or `undefined` when the
 *  referenced row isn't among `messages`. */
export const focusUuidForMainChat = (
    ref: MessageRef,
    chatType: number,
    messages: readonly MessageProps[]
): string | undefined => {
    if (isUuidRef(ref)) return ref;
    const id = Number(ref);
    if (!Number.isFinite(id)) return undefined;
    // PM main-channel links name the TASK, not the message: the pane is a
    // feed of task cards and `MessageBubble.handleMessageClick` puts the
    // task id in the segment. Non-PM links, and PM links that do carry a
    // seq (a reminder's), fall through to the seq match.
    const byTaskId = chatType === 3 ? messages.find((m) => m.taskId === id) : undefined;
    const row = byTaskId ?? messages.find((m) => Number(m.messageId) === id);
    return row?.messageIdWithChatId || undefined;
};

/** The v3 UUID to focus in a thread: the referenced reply, else the top
 *  of the thread so a thread link still lands somewhere deliberate. */
export const focusUuidForThread = (
    ref: MessageRef | undefined,
    messages: readonly ThreadMessageProps[]
): string | undefined => {
    const referenced =
        ref === undefined
            ? undefined
            : isUuidRef(ref)
              ? messages.find((m) => m.messageIdWithChatIdAndThreadId === ref)
              : messages.find((m) => Number(m.messageId) === Number(ref));
    return (referenced ?? messages[0])?.messageIdWithChatIdAndThreadId || undefined;
};
