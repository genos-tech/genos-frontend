import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../types/chat";
import { getLocalCurrentTimestamp } from "../../../utils/dateUtils";
import { loadV3SpecificMessages, readV3CachedMessages } from "../services/loadV3SpecificMessages";
import {
    loadV3SpecificThreadMessages,
    readV3CachedThreadMessages,
} from "../services/loadV3SpecificThreadMessages";
import { resolveV3MessageUuid, resolveV3ThreadRootUuid } from "../utils/channelIdResolvers";
import { parseChatRoute } from "../utils/parseChatRoute";
import {
    chatKey,
    recallThread,
    rememberThread,
    resolveThreadRestore,
    threadUrlToken,
} from "../utils/threadMemory";

// Chat type constants matching the existing codebase.
// Keys sorted alphabetically per `sort-keys` (the integer values are
// still the canonical kind codes — DM=1, GM=2, PM=3, MDM=4, activity=5,
// flagged=6 — and don't depend on key declaration order).
const CHAT_TYPE_MAP: Record<string, number> = {
    activity: 5,
    dm: 1,
    flagged: 6,
    gm: 2,
    mdm: 4,
    pm: 3,
};

export const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
    5: "activity",
    6: "flagged",
};

// Helper to build chat paths - defined outside component to avoid recreation
//
// `messageId` and `commentId` are mutually exclusive — either one focuses
// a thread message bubble (the existing flow) or one focuses a task
// comment in the PM thread's "Comments" tab. If both are passed,
// `commentId` wins (caller's choice was a deeper-link target).
export const buildChatPath = (
    typePath: string,
    // `chatId` widened to `string | number` for the v3 migration —
    // post-flip the runtime value is the UUID string from
    // `ChatProps.chatId`. Numeric callers (legacy code paths in
    // services still building integer-keyed URLs) keep working via
    // the template literal coercion.
    chatId?: string | number,
    // Widened alongside `chatId`: a DM/GM/MDM thread segment is the
    // thread-root UUID (string), PM keeps the numeric task id. See
    // `parseChatRoute`, which parses the segment back type-awarely.
    threadId?: number | string,
    messageId?: number,
    commentId?: number
): string => {
    let path = `/workspace/chat/${typePath}`;
    if (chatId !== undefined) path += `/${chatId}`;
    if (threadId !== undefined) path += `/thread/${threadId}`;
    if (commentId !== undefined) {
        path += `/comment/${commentId}`;
    } else if (messageId !== undefined) {
        path += `/message/${messageId}`;
    }
    return path;
};

type UseChatRoutingProps = {
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    myself: UserProps;
    // False while the Chat Home is kept mounted but hidden (keep-alive). When
    // false, this hook's navigations are suppressed so a backgrounded Chat
    // Home can't hijack the URL from the active service. See the `navigate`
    // wrapper below.
    isActiveRoute: boolean;
};

export const useChatRouting = ({ useCM, useTM, myself, isActiveRoute }: UseChatRoutingProps) => {
    const { accessToken } = useAuth();
    const rawNavigate = useNavigate();
    // Keep-alive gate. chat/tasks/notes Homes now stay mounted while hidden so
    // their heavy editors/tables survive a service switch (no rebuild → no
    // freeze). A hidden Home's routing effects still fire on foreign
    // pathnames, so we suppress its navigations at this single choke point —
    // otherwise e.g. Effect 1's "no chatType → redirect to /dm" would yank the
    // URL away from whatever service is actually active. When active this is a
    // transparent pass-through, so behaviour is byte-for-byte unchanged.
    const navigate = useCallback(
        (...args: unknown[]) => {
            if (!isActiveRoute) return;
            return (rawNavigate as (...a: unknown[]) => void)(...args);
        },
        [isActiveRoute, rawNavigate]
    ) as unknown as typeof rawNavigate;
    const location = useLocation();
    const pathname = location.pathname;

    // Ref to track if we're currently navigating from URL (to avoid circular updates)
    const isNavigatingFromUrl = useRef(false);
    // Ref to track the last URL we navigated to (to avoid duplicate navigations)
    const lastNavigatedPath = useRef("");
    // Ref to track pathname changes vs allChats.length changes in the URL sync effect
    const prevPathnameRef = useRef("");

    // Memoized parsed route - only recalculates when pathname changes.
    // The parsing itself lives in the pure, unit-tested `parseChatRoute`.
    const parsedRoute = useMemo(() => parseChatRoute(pathname), [pathname]);

    // Stable callback that returns the memoized parsed route
    const parseCurrentRoute = useCallback(() => parsedRoute, [parsedRoute]);

    // Navigate to a specific chat type
    const navigateToChatType = useCallback(
        (chatType: number) => {
            // set to true to not move chat pane type
            useCM.setNotMoveChatPaneType(false);

            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath));
            }
        },
        // Intentional: `useCM` is the legacy chat-management object —
        // re-deriving its callbacks on every render is fine, but adding
        // it to the dep list would re-create `navigateToChatType` for
        // every parent re-render and break downstream `React.memo`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [navigate]
    );

    // Navigate to a specific chat
    const navigateToChat = useCallback(
        (chatType: number, chatId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId));
            }
        },
        [navigate]
    );

    // Navigate to a specific thread
    const navigateToThread = useCallback(
        (chatType: number, chatId: number, threadId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId, threadId));
            }
        },
        [navigate]
    );

    // Navigate to a specific message
    const navigateToMessage = useCallback(
        (chatType: number, chatId: number, messageId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(`/workspace/chat/${typePath}/${chatId}/message/${messageId}`);
            }
        },
        [navigate]
    );

    // Navigate to a specific message in a thread
    const navigateToThreadMessage = useCallback(
        (chatType: number, chatId: number, threadId: number, messageId: number) => {
            const typePath = CHAT_TYPE_REVERSE_MAP[chatType];
            if (typePath) {
                navigate(buildChatPath(typePath, chatId, threadId, messageId));
            }
        },
        [navigate]
    );

    // Memoized current chat type from URL - avoids recalculating on every access
    const currentChatTypeFromUrl = useMemo((): number => {
        const { chatType } = parsedRoute;
        if (chatType && CHAT_TYPE_MAP[chatType]) {
            return CHAT_TYPE_MAP[chatType];
        }
        return 1; // Default to DM
    }, [parsedRoute]);

    // Stable callback for getting current chat type
    const getCurrentChatTypeFromUrl = useCallback(
        (): number => currentChatTypeFromUrl,
        [currentChatTypeFromUrl]
    );

    // Helper to process thread messages - extracted to reduce duplication
    const processThreadMessages = useCallback(
        (
            threadMessages: ThreadMessageProps[],
            chatId: number,
            threadId: number,
            paneType: number,
            messageId: number | undefined,
            useTaskIdAsThreadId: boolean,
            // Set the thread synchronously instead of after the 250ms
            // settle below. Used by the optimistic cache paint, which is
            // the whole point of that path — deferring it would hand back
            // the latency we just saved. The deferred default is kept for
            // the network path, where the delay lets the pane mount
            // before `moveToSpecificIndex` drives the scroll.
            immediate = false
        ) => {
            if (!threadMessages || threadMessages.length === 0) {
                useCM.setIsThreadVisible(true);
                return;
            }

            // Keys sorted alphabetically per `sort-keys`.
            const firstMessage = threadMessages[0];
            const newThread: ThreadProps = {
                chatId,
                chatName: useCM.currentMainChat?.chatName || "",
                chatType: paneType,
                dmPartnerUser: myself,
                messages: threadMessages,
                moveToSpecificIndex: undefined,
                project: firstMessage.project,
                taskExist: firstMessage.taskExist,
                taskId: firstMessage.taskId || null,
                threadId: useTaskIdAsThreadId ? firstMessage.threadId : threadId,
                TSLastMessage: getLocalCurrentTimestamp(),
            };

            const applyThread = () => {
                // The thread indexMap + focus-highlight key on the bare v3
                // reply UUID (`messageIdWithChatIdAndThreadId`). The old
                // `${chatId}-${threadId}-${messageId}` composite embeds two
                // UUIDs now (chatId + threadId are v3 UUIDs) and never
                // matches a bare-UUID key, so a thread deep-link loaded the
                // thread but never scrolled to / highlighted the reply.
                // `messageId` is the still-numeric URL seq, so resolve the
                // reply by it within the loaded thread messages.
                const target =
                    messageId !== undefined
                        ? threadMessages.find((m) => Number(m.messageId) === messageId)
                        : undefined;
                const newMoveIndex = (target ?? threadMessages[0])?.messageIdWithChatIdAndThreadId;
                useCM.setCurrentThreadChat({ ...newThread, moveToSpecificIndex: newMoveIndex });
            };

            if (immediate) {
                applyThread();
            } else {
                setTimeout(applyThread, 250);
            }

            if (newThread.taskExist === true && firstMessage.taskId) {
                useTM.setCurrentPreviewTaskId(firstMessage.taskId);
            }

            useCM.setIsThreadVisible(true);
        },
        [myself, useCM, useTM]
    );

    // Effect 1: Handle missing chat type - redirect to default
    useEffect(() => {
        const { chatType, chatId, threadId, messageId } = parsedRoute;

        const isPathnameChange = prevPathnameRef.current !== pathname;
        prevPathnameRef.current = pathname;

        // Keep the state→URL effects' dedup ref aligned with the real URL
        // after a browser Back/Forward, so re-selecting a previously
        // visited chat/thread isn't silently skipped (see the matching
        // note in useTaskRouting). Only on a genuine URL change — an
        // allChats.length re-run must not clobber a freshly-pushed path.
        if (isPathnameChange) {
            lastNavigatedPath.current = pathname;
        }

        // If no chat type in URL, redirect to default (dm)
        if (!chatType) {
            const lastChatType = localStorage.getItem("lastChatType");
            const defaultType = lastChatType ? CHAT_TYPE_REVERSE_MAP[Number(lastChatType)] : "dm";
            navigate(`/workspace/chat/${defaultType || "dm"}`, { replace: true });
            return;
        }

        // Cache pane type lookup - avoid repeated CHAT_TYPE_MAP access
        const paneType = CHAT_TYPE_MAP[chatType];
        if (!paneType) return;

        // MDM (type 4) is now displayed within the DM section (type 1)
        // So when navigating to MDM, set the pane type to DM
        const effectivePaneType = paneType === 4 ? 1 : paneType;

        // Update chat pane type from URL
        if (
            useCM.currentChatPaneType !== effectivePaneType &&
            useCM.notMoveChatPaneType === false
        ) {
            useCM.setCurrentChatPaneType(effectivePaneType);
            localStorage.setItem("currentChatPaneType", effectivePaneType.toString());
            useCM.setNotMoveChatPaneType(false); // set to false by default
        }

        // Early exit if no chatId or allChats not loaded
        const allChatsLength = useCM.allChats.length;
        if (!chatId || allChatsLength === 0) return;

        const existingChat = useCM.allChats.find(
            (c) => c.chatId === chatId && c.chatType === paneType
        );
        if (!existingChat) return;

        const currentMainChatId = useCM.currentMainChat?.chatId;

        // If chat is already loaded but we need to focus on a specific message
        if (currentMainChatId === chatId && messageId && threadId === undefined) {
            // v3 format: `moveToSpecificIndex` is now the message's v3
            // UUID, matching the `messageIdWithChatId` field that
            // `MessageListRenderer.resolveFocusedState` reads. The URL
            // `messageId` segment is still the legacy seq (or task id
            // for PM); resolve through the snapshot.
            const isPm = paneType === 3;
            const newMoveIndex = resolveV3MessageUuid(chatId, messageId, isPm);
            if (newMoveIndex && useCM.currentMainChat!.moveToSpecificIndex !== newMoveIndex) {
                // Functional updater. The closure-captured
                // `useCM.currentMainChat` lags behind the channelService
                // live-update subscription (`useChatManagement.ts`
                // main-pane apply), so spreading it can revert message
                // deletes / edits between when this effect armed and
                // when React processes it.
                useCM.setCurrentMainChat((prev) =>
                    prev ? { ...prev, moveToSpecificIndex: newMoveIndex } : prev
                );
            }
        }
        // If it's a different chat, load it
        else if (currentMainChatId !== chatId) {
            // When only allChats.length changed (not the URL), and currentMainChat is
            // already set, don't override it. This prevents the URL sync from reverting
            // a chat that was just set programmatically (e.g. via moveToSelectedChat).
            if (!isPathnameChange && currentMainChatId !== undefined) return;

            isNavigatingFromUrl.current = true;

            // Paint the chat INSTANTLY from the in-memory snapshot so the
            // pane doesn't sit blank for the ~1s `syncChannel` round-trip
            // that `loadV3SpecificMessages` awaits below (back/forward,
            // deep links, refresh-to-chat all hit this path). This is
            // additive: the `.then` still runs the network sync and
            // refines `moveToSpecificIndex` for deep-link-to-message, and
            // the `useChatManagement` live-update subscription keeps
            // messages fresh. This effect's deps are
            // `[pathname, allChats.length]` (NOT currentMainChat), so the
            // optimistic set can't re-trigger it.
            const cachedMessages = readV3CachedMessages(chatId, existingChat.chatType);
            if (cachedMessages.length > 0) {
                const lastCached = cachedMessages[cachedMessages.length - 1];
                useCM.setCurrentMainChat({
                    chatId: existingChat.chatId,
                    chatName: existingChat.chatName,
                    chatType: existingChat.chatType,
                    dmPartnerUser: existingChat.dmPartnerUser,
                    isPrivate: existingChat.isPrivate,
                    lastReadMessageId: String(lastCached.messageId),
                    latestMessage: existingChat.latestMessage,
                    latestMessageText: existingChat.latestMessageText,
                    messages: cachedMessages,
                    moveToSpecificIndex: undefined,
                    profileImagePath: existingChat.profileImagePath,
                    project: existingChat.project,
                    systemUserId: existingChat.systemUserId,
                    TSLastMessage: existingChat.TSLastMessage,
                });
                useCM.setIsMainChatVisible(true);
            }

            // v3 unified path: `loadV3SpecificMessages` handles every
            // chat kind (DM/GM/PM/MDM) uniformly through channelService,
            // so the legacy MDM `/history/` fallback for empty results
            // is no longer needed — the v3 sync either returns rows or
            // the channel genuinely has none.
            loadV3SpecificMessages(chatId, existingChat.chatType)
                .then(async (messages: MessageProps[]) => {
                    const resolvedMessages = messages;
                    if (resolvedMessages.length === 0) return;

                    const lastMessage = resolvedMessages[resolvedMessages.length - 1];
                    // Keys sorted alphabetically (case-insensitive) per
                    // `sort-keys`. `lastReadMessageId: String(...)` bridges
                    // the legacy numeric `MessageProps.messageId` to the
                    // v3-flipped `ChatProps.lastReadMessageId: string`.
                    const newChat: ChatProps = {
                        chatId: existingChat.chatId,
                        chatName: existingChat.chatName,
                        chatType: existingChat.chatType,
                        dmPartnerUser: existingChat.dmPartnerUser,
                        isPrivate: existingChat.isPrivate,
                        lastReadMessageId: String(lastMessage.messageId),
                        latestMessage: existingChat.latestMessage,
                        latestMessageText: existingChat.latestMessageText,
                        messages: resolvedMessages,
                        moveToSpecificIndex: undefined,
                        profileImagePath: existingChat.profileImagePath,
                        project: existingChat.project,
                        systemUserId: existingChat.systemUserId,
                        TSLastMessage: existingChat.TSLastMessage,
                    };

                    setTimeout(() => {
                        // `chatId !== ""` is the v3-flipped "valid chat?"
                        // sentinel (replaces legacy `!== -1`).
                        const isValidChat = useCM.currentMainChat?.chatId !== "";
                        // v3 `moveToSpecificIndex` carries the message's
                        // v3 UUID so the bubble's `messageIdWithChatId`
                        // matches in `MessageListRenderer`. Resolve the
                        // URL `messageId` (legacy seq, or task id for
                        // PM) via the snapshot.
                        const isPm = paneType === 3;
                        const newMoveIndex =
                            threadId === undefined
                                ? messageId && isValidChat
                                    ? (resolveV3MessageUuid(chatId, messageId, isPm) ?? undefined)
                                    : undefined
                                : isValidChat
                                  ? (resolveV3MessageUuid(chatId, threadId, isPm) ?? undefined)
                                  : undefined;
                        useCM.setCurrentMainChat({
                            ...newChat,
                            moveToSpecificIndex: newMoveIndex,
                        });
                    }, 250);

                    useCM.setIsMainChatVisible(true);
                })
                .catch((error) => console.error("Error loading chat from URL:", error))
                .finally(() => {
                    setTimeout(() => {
                        isNavigatingFromUrl.current = false;
                    }, 100);
                });
        }

        // Handle thread message from URL
        const shouldLoadThread =
            threadId &&
            (useCM.currentThreadChat === undefined ||
                useCM.currentThreadChat?.threadId !== threadId);

        if (shouldLoadThread) {
            // v3 path: resolve the URL `threadId` to the parent message's
            // v3 UUID, then load thread replies for that UUID via
            // channelService. Post-v3 the segment is already the thread-
            // root UUID for DM/GM/MDM (passed straight through) or the
            // numeric task_id for PM (resolved via the snapshot). The
            // legacy `processThreadMessages` slot still types things as
            // `number` — carry the UUID via `as unknown as number` like
            // the rest of the migration.
            const isPm = paneType === 3;
            const threadRootUuid = resolveV3ThreadRootUuid(chatId, threadId, isPm);
            if (threadRootUuid) {
                // Paint the thread INSTANTLY from the in-memory snapshot
                // (hydrated from IDB on boot, kept warm by every sync),
                // exactly as the main-chat branch above already does.
                //
                // This branch used to go straight to
                // `loadV3SpecificThreadMessages`, which AWAITS a full
                // `syncChannel` round-trip before it returns anything —
                // and then handed the result to the 250ms settle. Opening
                // a thread from the URL (deep link, back/forward, and the
                // per-chat restore) therefore cost ~1s + 250ms of blank
                // pane even when every reply was already in IDB. Thread
                // replies live in the same `messagesByChannel` slice as
                // top-level rows, so a channel we've already opened has
                // them cached.
                //
                // Revalidation is not lost: `useChatManagement`'s thread
                // subscription is keyed on the open thread's channel +
                // root and patches `currentThreadChat.messages` from the
                // snapshot whenever the background sync lands.
                const cachedThreadMessages = readV3CachedThreadMessages(
                    chatId,
                    threadRootUuid,
                    paneType
                );
                const paintedFromCache = cachedThreadMessages.length > 0;
                if (paintedFromCache) {
                    processThreadMessages(
                        cachedThreadMessages,
                        chatId as unknown as number,
                        threadRootUuid as unknown as number,
                        paneType,
                        messageId,
                        isPm,
                        // Synchronous only when there is no reply to
                        // scroll to. With a `/message/:id` target the
                        // 250ms settle is load-bearing — it lets the
                        // pane mount before `moveToSpecificIndex` drives
                        // the scroll — so deep links keep the old
                        // timing exactly. They still skip the network,
                        // which is the bulk of the wait.
                        messageId === undefined
                    );
                    // Background revalidate only — the subscription above
                    // applies whatever comes back, so there is nothing to
                    // await and no second `processThreadMessages` (which
                    // would re-set the thread 250ms later and re-run the
                    // scroll for no reason).
                    void channelService
                        .syncChannel(chatId)
                        .catch((error) =>
                            console.error("[useChatRouting] thread revalidate failed:", error)
                        );
                } else {
                    // Never-cached thread (first-ever open, or a cold boot
                    // before hydration): nothing to paint, so take the
                    // awaited path as before.
                    loadV3SpecificThreadMessages(chatId, threadRootUuid, paneType).then(
                        (threadMessages: ThreadMessageProps[]) => {
                            processThreadMessages(
                                threadMessages,
                                chatId as unknown as number,
                                threadRootUuid as unknown as number,
                                paneType,
                                messageId,
                                isPm
                            );
                        }
                    );
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname, useCM.allChats.length]);

    // Update URL when main chat changes (user navigates via UI)
    useEffect(() => {
        const { chatId: urlChatId, chatType: urlChatType } = parsedRoute;

        // Skip if we're currently navigating from URL (to avoid circular updates)
        const currentMainChat = useCM.currentMainChat;
        const urlChatTypeNum = urlChatType ? CHAT_TYPE_MAP[urlChatType] : undefined;
        if (
            isNavigatingFromUrl.current ||
            (urlChatId === currentMainChat?.chatId && urlChatTypeNum === currentMainChat?.chatType)
        ) {
            return;
        }

        if (!currentMainChat || currentMainChat.chatId === "") return;

        // When a thread is visible, let the thread URL effect handle the full URL
        if (useCM.isThreadVisible && useCM.currentThreadChat) return;

        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        const newPath = buildChatPath(typePath, currentMainChat.chatId);

        // Guard against stripping valid deep-link segments. The `pathname`
        // variable in this closure can briefly lag the actual browser URL
        // when state + router updates aren't batched into the same render
        // (e.g. Spotlight's `moveToSpecificChat` does setCurrentMainChat
        // + navigate("/chat/pm/1/message/6") inside an async fn; the
        // render that fires this effect sometimes sees the new
        // currentMainChat but the OLD pathname, so the equality check at
        // the top of the effect fails and we end up here, replacing the
        // freshly-pushed `/message/6` URL back to chat-level only).
        //
        // We check `window.location.pathname` directly — it always
        // reflects the true URL. If the real URL is already inside the
        // chat we're syncing to (i.e. starts with `newPath + "/"` or
        // equals `newPath`), leave it alone; the trailing `/thread/...`
        // and `/message/...` segments are intentional and should survive.
        const currentBrowserPath = window.location.pathname;
        if (currentBrowserPath === newPath || currentBrowserPath.startsWith(newPath + "/")) {
            return;
        }

        // Only update if path is different
        if (newPath !== pathname && newPath !== lastNavigatedPath.current) {
            lastNavigatedPath.current = newPath;
            // Push (not replace) so each opened chat is its own history
            // entry — browser Back/Forward steps between chats.
            navigate(newPath);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.currentMainChat?.chatId, useCM.currentMainChat?.chatType]);

    // Update URL when thread opens
    useEffect(() => {
        const currentMainChat = useCM.currentMainChat;
        const currentThreadChat = useCM.currentThreadChat;

        if (
            !useCM.isThreadVisible ||
            !currentThreadChat ||
            !currentMainChat ||
            currentMainChat.chatId === ""
        ) {
            return;
        }

        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        // Shared with `threadMemory` so a remembered thread replays into
        // exactly the path this effect would have produced.
        const threadId = threadUrlToken(currentThreadChat);

        // Preserve the deep-link target already in the URL. `commentId`
        // wins over `messageId` because the user explicitly navigated
        // to a task comment (PM "Comments" tab), and we don't want a
        // stale `moveToSpecificIndex` (the thread bubble's focus state)
        // to overwrite the active comment focus.
        const { commentId } = parsedRoute;
        let { messageId } = parsedRoute;
        if (commentId === undefined && !messageId && currentThreadChat.moveToSpecificIndex) {
            const parts = currentThreadChat.moveToSpecificIndex.split("-");
            if (parts.length >= 3) {
                const parsedMsgId = Number(parts[parts.length - 1]);
                if (!isNaN(parsedMsgId) && parsedMsgId > 0) {
                    messageId = parsedMsgId;
                }
            }
        }

        const newPath = buildChatPath(
            typePath,
            currentMainChat.chatId,
            threadId,
            messageId,
            commentId
        );

        // This effect has no `isNavigatingFromUrl` guard, so a Back-driven
        // thread load (Effect 1 → setCurrentThreadChat → this effect) would
        // re-push the URL we just landed on. Bail when the target already
        // matches the live URL — mirrors the main-chat effect's guard — so
        // push semantics can't corrupt the history stack. `window.location`
        // (not the closure `pathname`) is read because the closure can lag
        // the real URL by a render.
        if (newPath === window.location.pathname) return;
        // Push (not replace) so each opened thread is its own history
        // entry — browser Back/Forward steps between threads. `threadId`
        // is in the deps so switching threads within one chat re-fires
        // this effect (the old `chatId`-only deps tracked the main chat,
        // not the thread, so thread→thread never updated the URL).
        navigate(newPath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        useCM.isThreadVisible,
        useCM.currentThreadChat?.chatId,
        useCM.currentThreadChat?.threadId,
    ]);

    // Remember which thread each chat had open.
    //
    // Recorded from the live pane rather than from the click handlers so
    // every way of opening a thread (bubble reply, activity row, deep
    // link, flagged list) is covered by one rule. The parent-chat guard
    // drops the `dummyThreadChat` placeholder the close buttons install
    // and any half-swapped state mid-chat-switch.
    useEffect(() => {
        const currentMainChat = useCM.currentMainChat;
        const currentThreadChat = useCM.currentThreadChat;
        if (!useCM.isThreadVisible || !currentThreadChat || !currentMainChat) return;
        if (String(currentThreadChat.chatId) !== String(currentMainChat.chatId)) return;

        const token = threadUrlToken(currentThreadChat);
        if (token === undefined || token === null || token === "") return;
        rememberThread(currentMainChat.chatType, currentMainChat.chatId, token);
        // Primitive slices only, like the URL effects above: the chat and
        // thread OBJECTS churn on every message patch, and re-running this
        // on that would rewrite the same value dozens of times a minute.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        useCM.isThreadVisible,
        useCM.currentMainChat?.chatId,
        useCM.currentMainChat?.chatType,
        useCM.currentThreadChat?.chatId,
        useCM.currentThreadChat?.threadId,
        useCM.currentThreadChat?.taskId,
    ]);

    // Keep the thread pane tied to the chat pane.
    //
    // Keyed on `currentMainChat` identity, NOT on the URL: chat selection
    // is state-first (`useChatListItem` calls `setCurrentMainChat` with no
    // navigate), and the main-chat URL effect above deliberately bails
    // while a thread is visible — so switching chats with a thread open
    // changes no URL at all. A URL-keyed reconcile would never fire on
    // the exact case this fixes.
    //
    // Two jobs, in order:
    //   1. A thread belonging to a DIFFERENT chat must never remain on
    //      screen beside this one. Closing it also releases the
    //      `isThreadVisible` guard in the main-chat URL effect, which then
    //      corrects the now-stale chat URL on its own.
    //   2. Restore the thread this chat last had open, unless the user
    //      closed it by hand (`forgetThread` at the close buttons).
    useEffect(() => {
        const currentMainChat = useCM.currentMainChat;
        if (!currentMainChat || currentMainChat.chatId === "") return;

        const currentThreadChat = useCM.currentThreadChat;
        const threadBelongsHere =
            currentThreadChat !== undefined &&
            String(currentThreadChat.chatId) === String(currentMainChat.chatId);

        if (useCM.isThreadVisible && threadBelongsHere) return;

        // (1) Unconditional — never gated on the memory, or a foreign
        // thread could stay visible when this chat has no remembered one.
        if (currentThreadChat !== undefined && !threadBelongsHere) {
            useCM.setIsThreadVisible(false);
            useCM.setCurrentThreadChat(undefined);
        }

        // (2) Decide what the URL should say for the chat that is now
        // open. `window.location` (not the closure `pathname`, which can
        // lag a render behind) — same reasoning as the guards in the URL
        // effects above.
        const typePath = CHAT_TYPE_REVERSE_MAP[currentMainChat.chatType];
        if (!typePath) return;

        const liveRoute = parseChatRoute(window.location.pathname);
        const liveChatTypeCode = liveRoute.chatType
            ? CHAT_TYPE_MAP[liveRoute.chatType]
            : undefined;
        const mainChatKey = chatKey(currentMainChat.chatType, currentMainChat.chatId);
        const urlChatKey =
            liveChatTypeCode !== undefined && liveRoute.chatId !== undefined
                ? chatKey(liveChatTypeCode, liveRoute.chatId)
                : undefined;

        const remembered = recallThread(currentMainChat.chatType, currentMainChat.chatId);
        const decision = resolveThreadRestore({
            mainChatKey,
            remembered,
            urlChatKey,
            urlHasExplicitTarget:
                liveRoute.threadId !== undefined ||
                liveRoute.messageId !== undefined ||
                liveRoute.commentId !== undefined,
        });
        if (decision === "keep-url") return;

        const targetPath =
            decision === "restore-thread"
                ? buildChatPath(typePath, currentMainChat.chatId, remembered)
                : buildChatPath(typePath, currentMainChat.chatId);

        if (window.location.pathname === targetPath) return;

        // Push when the URL was describing a DIFFERENT chat — that's a
        // real chat switch which the main-chat URL effect above skipped
        // (it bails while a thread is visible), so this is the entry it
        // would have pushed. Replace when we're only adding or dropping
        // the thread segment within the chat already in the URL: an
        // automatic restore isn't a navigation step the user took.
        navigate(targetPath, { replace: urlChatKey === mainChatKey });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [useCM.currentMainChat?.chatId, useCM.currentMainChat?.chatType]);

    // Keys sorted alphabetically (case-insensitive) per `sort-keys`.
    return {
        CHAT_TYPE_MAP,
        CHAT_TYPE_REVERSE_MAP,
        getCurrentChatTypeFromUrl,
        navigateToChat,
        navigateToChatType,
        navigateToMessage,
        navigateToThread,
        navigateToThreadMessage,
        parseCurrentRoute,
    };
};
