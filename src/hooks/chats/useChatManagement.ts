import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
    v3ChannelsToLegacyChats,
    v3FlagsToLegacy,
    v3MessagesToLegacy,
    v3ThreadMessagesToLegacy,
} from "../../features/chat/adapters/v3ToLegacy";
import { popActivityMessages } from "../../features/chat/components/sidebar/activity/services/popActivityMessages";
import { loadV3Chats } from "../../features/chat/services/loadV3Chats";
import { loadV3SpecificMessages } from "../../features/chat/services/loadV3SpecificMessages";
import { loadV3SpecificThreadMessages } from "../../features/chat/services/loadV3SpecificThreadMessages";
import { countUnreadActivityTopics } from "../../features/chat/utils/activityAggregation";
import {
    resolveV3MessageUuid,
    resolveV3ThreadRootUuid,
} from "../../features/chat/utils/channelIdResolvers";
import { channelService } from "../../services/channel/channelService";
import { UserProps } from "../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../types/chat";
import { ProjectProps } from "../../types/tasks";

// Chat type constants for URL routing
const CHAT_TYPE_REVERSE_MAP: Record<number, string> = {
    1: "dm",
    2: "gm",
    3: "pm",
    4: "mdm",
};

export interface ChatManagementState {
    isMainChatVisible: boolean;
    setIsMainChatVisible: (value: boolean) => void;
    isSubChatVisible: boolean;
    setIsSubChatVisible: (value: boolean) => void;
    isThreadVisible: boolean;
    setIsThreadVisible: (value: boolean) => void;
    isThreadTaskVisible: boolean;
    setIsThreadTaskVisible: (value: boolean) => void;
    isChatNoteVisibleInChat: boolean;
    setIsChatNoteVisibleInChat: (value: boolean) => void;
    currentChatPaneType: number;
    setCurrentChatPaneType: (value: number) => void;
    notMoveChatPaneType: boolean;
    setNotMoveChatPaneType: (value: boolean) => void;
    currentMainChat: ChatProps | undefined;
    // Widened to the full `Dispatch<SetStateAction<...>>` so the v3
    // channelService subscription (and any future caller) can patch
    // a single field via the functional updater without reading a
    // stale closure value at render time.
    setCurrentMainChat: Dispatch<SetStateAction<ChatProps | undefined>>;
    currentSubChat: ChatProps | undefined;
    // Same widening as `setCurrentMainChat` — the parallel v3
    // channelService subscription on `currentSubChat` patches in
    // place via functional updater.
    setCurrentSubChat: Dispatch<SetStateAction<ChatProps | undefined>>;
    currentThreadChat: ThreadProps | undefined;
    // Widened to the full `Dispatch<SetStateAction<...>>` so callers can use
    // the functional updater form `setCurrentThreadChat((prev) => ...)` to
    // patch a single field without reading the current value at render time.
    // This is what makes downstream `React.memo` on message bubbles safe —
    // handlers no longer close over a stale `useCM.currentThreadChat`.
    setCurrentThreadChat: Dispatch<SetStateAction<ThreadProps | undefined>>;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[] | ((prev: AllChatProps[]) => AllChatProps[])) => void;
    flaggedMessages: FlaggedMessageProps[];
    // Same reasoning as setCurrentThreadChat above.
    setFlaggedMessages: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
    // Completed ("done") flags for the past-flagged view. Derived off the
    // same v3 snapshot as `flaggedMessages` but filtered to completed.
    pastFlaggedMessages: FlaggedMessageProps[];
    setPastFlaggedMessages: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
    // Loads completed flags from the server into the snapshot (they're not
    // broadcast to fresh sessions); the subscription then derives the list.
    funcSetPastFlaggedMessages: () => Promise<void>;
    activityMessages: ActivityMessageProps[];
    setActivityMessages: (value: ActivityMessageProps[]) => void;
    unReadChatCounts: Record<string, number>;
    setUnReadChatCounts: (value: Record<string, number>) => void;
    unReadActivityMessageCounts: number;
    setUnReadActivityMessageCounts: (value: number) => void;
    unReadChatAndActivityCounts: number;
    setUnReadChatAndActivityCounts: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    funcSetFlaggedMessages: () => Promise<void>;
    funcSetActivityMessages: () => Promise<void>;
    moveToSpecificChat: (
        chatType: number,
        // v3 ids are UUID strings (Spotlight / citation chips); legacy
        // callers may still pass integer seq/ids. Accept both.
        chatId: string | number,
        threadId: string | number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: ProjectProps | null) => void,
        // Optional matched-message focus (used by Spotlight / citation
        // chips). When present the helper sets `moveToSpecificIndex` on
        // the chat / thread so the list scrolls to the bubble, and
        // appends `/message/:id` to the URL. Omit for no message focus.
        messageId?: string | number,
        // Cross-page "open the task preview ON THE CHAT PAGE" intent. Only
        // the task-page "Check Thread" / "openThread" entry points set this;
        // the deep-link callers (notification / search / history / citation)
        // leave it at its `false` default so they stay no-ops here. See the
        // implementation for the full rationale.
        openChatPageTaskPreview?: boolean
    ) => Promise<void>;
    moveToSpecificThreadChat: (
        chat: AllChatProps,
        threadId: string | number
    ) => Promise<ThreadProps | null>;
    defineNewChat: (chat: AllChatProps, messages: MessageProps[]) => ChatProps;
    showOnlyInCompleteTodos: boolean;
    setShowOnlyInCompleteTodos: (value: boolean) => void;
}

export const useChatManagement = (
    myself: UserProps,
    accessToken: string | null
): ChatManagementState => {
    const navigate = useNavigate();

    // Chat visibility states
    const [isMainChatVisible, setIsMainChatVisible] = useState(true);
    const [isSubChatVisible, setIsSubChatVisible] = useState(false);
    const [isThreadVisible, setIsThreadVisible] = useState(false);
    const [isThreadTaskVisible, setIsThreadTaskVisible] = useState(false);
    const [isChatNoteVisibleInChat, setIsChatNoteVisibleInChat] = useState(false);

    // Chat type state
    const [currentChatPaneType, setCurrentChatPaneType] = useState<number>(
        Number(localStorage.getItem("currentChatPaneType") || "1")
    );

    // Not move chat pane type state
    // true: not move chat pane type (used for activity and flagged chats only via UI)
    // false: move chat pane type (used for all chats via URL)
    const [notMoveChatPaneType, setNotMoveChatPaneType] = useState<boolean>(false);

    // To-Do visibility state: 0: show only incomplete todos, 1: show all todos
    const [showOnlyInCompleteTodos, setShowOnlyInCompleteTodos] = useState<boolean>(
        Number(localStorage.getItem("showOnlyInCompleteTodos") || "0") === 0 ? true : false
    );

    // Current chats
    const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();

    // Chat data
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessageProps[]>([]);
    const [pastFlaggedMessages, setPastFlaggedMessages] = useState<FlaggedMessageProps[]>([]);
    const [activityMessages, setActivityMessages] = useState<ActivityMessageProps[]>([]);

    // Unread counts
    const [unReadChatCounts, setUnReadChatCounts] = useState<Record<string, number>>({});
    const [unReadActivityMessageCounts, setUnReadActivityMessageCounts] = useState<number>(-1);
    const [unReadChatAndActivityCounts, setUnReadChatAndActivityCounts] = useState<number>(0);

    const funcSetFlaggedMessages = async () => {
        // v3 source. The dedicated `channelService.subscribe` effect
        // below pushes fresh `flaggedMessages` on every flag-add /
        // flag-remove broadcast — this function exists for the legacy
        // initialization / wake-refresh callers that still call it
        // imperatively. It re-derives from the same v3 snapshot so the
        // shape matches what the subscription emits.
        //
        // NOTE: the legacy `popFlaggedMessages` IDB pop is intentionally
        // gone. Keeping it active raced with the v3 subscription —
        // whichever finished last won, and the legacy result carried
        // legacy-int chatId/messageId which broke the v3-shape
        // assumptions in the click handler.
        let snapshot = channelService.getSnapshot();
        // Back-fill flagged messages whose host channel hasn't been synced
        // this session: they aren't in `messagesByChannel`, so
        // `v3FlagsToLegacy` (a pure adapter) would silently drop them and
        // the flagged sidebar would under-report. Fetch the missing ones
        // by id, then re-read the snapshot before adapting.
        const inSnapshot = (messageId: string): boolean => {
            for (const msgs of snapshot.messagesByChannel.values()) {
                if (msgs.some((m) => m.id === messageId)) return true;
            }
            return false;
        };
        const missing = Array.from(snapshot.flags.values()).filter(
            // Only back-fill ACTIVE flags here; completed flags are loaded
            // + back-filled separately by funcSetPastFlaggedMessages.
            (f) => !f.completedAt && !inSnapshot(f.messageId)
        );
        if (missing.length > 0) {
            await Promise.all(missing.map((f) => channelService.fetchMessageById(f.messageId)));
            snapshot = channelService.getSnapshot();
        }
        const next = v3FlagsToLegacy({
            flags: snapshot.flags,
            channels: snapshot.channels,
            membersByChannel: snapshot.membersByChannel,
            messagesByChannel: snapshot.messagesByChannel,
            currentUserId: myself.userId || null,
        });
        setFlaggedMessages(next);
    };

    // Fetch completed flags from the server into the snapshot; the flagged
    // subscription below then derives `pastFlaggedMessages` from it.
    const funcSetPastFlaggedMessages = async () => {
        await channelService.fetchCompletedFlags();
    };

    const funcSetAllChats = async () => {
        // Source flipped from the legacy per-type IDB chain
        // (`popAllChats` → worker → 4× per-type stores) to the v3
        // unified channel store. The wire-shape conversion lives in
        // `features/chat/adapters/v3ToLegacy.ts`.
        //
        // PUNCH LIST (carry-over from the legacy fn):
        //   - The "initial DM chat" filter (`latestMessage.messageId <= 1`)
        //     handled a quirky empty-DM stub the legacy backend served on
        //     first DM contact. The v3 backend doesn't ship that stub, so
        //     the filter has no equivalent here.
        //   - The `setAllChats((prev) => [...new, ...preservedNotInLoad])`
        //     merge guarded against the worker IDB lagging a fresh
        //     write. The v3 channelService is the single source of truth
        //     in the main thread, so the prior-state merge isn't
        //     necessary on this path.
        const fresh = await loadV3Chats(myself.userId || null);
        setAllChats(fresh);
        setUnReadChatCounts(countUnreadChats(fresh));
    };

    const funcSetActivityMessages = async () => {
        const activityMessages: ActivityMessageProps[] = await popActivityMessages(myself);
        if (activityMessages) {
            setActivityMessages(activityMessages);
            setUnReadActivityMessageCounts(countUnreadActivityMessages(activityMessages));
        }
    };

    const countUnreadChats = (chats: AllChatProps[]): Record<string, number> => {
        return chats.reduce<Record<string, number>>((acc, chat) => {
            // `lastReadMessageId` is `string` post-v3 type flip; the
            // legacy `messageId` is still numeric. While the migration
            // straddles both shapes, defineNewChat writes lastRead as
            // a stringified int — Number() round-trips that. UUID-shaped
            // cursors will Number() to NaN and skip the increment, which
            // is the safer side of the migration gap (over-count is worse
            // than under-count for the unread badge).
            const lastRead = Number(chat.lastReadMessageId || "0");
            if (chat.latestMessage && lastRead < chat.latestMessage.messageId) {
                acc[chat.chatType] = (acc[chat.chatType] ?? 0) + 1;
            }
            return acc;
        }, {});
    };

    // Aggregated units — the badge counts unread TOPICS, matching the
    // same-topic collapsing the sidebar feed applies (100 unread replies
    // in one thread render as one feed row, so the badge says 1 and
    // clearing that row zeroes it).
    const countUnreadActivityMessages = (activityMessages: ActivityMessageProps[]): number => {
        return countUnreadActivityTopics(activityMessages);
    };

    const defineNewChat = (chat: AllChatProps, messages: MessageProps[]): ChatProps => {
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : chat.latestMessage;
        // `lastReadMessageId` is a string after the v3 type flip; the
        // legacy `messageId` is still numeric, so we stringify on
        // assignment. Empty string is the "no messages yet" sentinel
        // (replaces the legacy `-1`).
        return {
            chatId: chat.chatId,
            chatName: chat.chatName,
            chatType: chat.chatType,
            dmPartnerUser: chat.dmPartnerUser,
            isPrivate: chat.isPrivate,
            lastReadMessageId: lastMsg?.messageId != null ? String(lastMsg.messageId) : "",
            latestMessage: lastMsg ?? chat.latestMessage,
            latestMessageText: lastMsg?.contentText ?? chat.latestMessageText ?? "",
            messages: messages,
            profileImagePath: chat.profileImagePath,
            project: chat.project,
            systemUserId: chat.systemUserId,
            TSLastMessage: lastMsg?.tsSent ?? chat.TSLastMessage ?? "",
        };
    };

    const moveToSpecificThreadChat = async (chat: AllChatProps, threadId: string | number) => {
        // v3 path: resolve the legacy `threadId` (parent-seq for
        // DM/GM/MDM; task_id for PM) to the parent message's v3 UUID,
        // then load thread replies for that UUID via channelService.
        // The legacy `threadId: number` slot on ThreadProps carries
        // the UUID through via `as unknown as number` — same pattern
        // as `chatId`.
        const isPm = chat.chatType === 3;
        const threadRootUuid = resolveV3ThreadRootUuid(chat.chatId, threadId, isPm);
        if (!threadRootUuid) {
            return null;
        }
        const threadMessages: ThreadMessageProps[] = await loadV3SpecificThreadMessages(
            chat.chatId,
            threadRootUuid,
            chat.chatType
        );
        if (threadMessages && threadMessages.length > 0) {
            const lastThreadMsg = threadMessages[threadMessages.length - 1];
            // A thread's task linkage lives on the message the task was
            // created from — the thread ROOT (`messages[0]`), per
            // `v3ThreadMessagesToLegacy` which returns `[root, ...replies]`.
            // Reading it off `lastThreadMsg` (the last reply) made a thread
            // look task-less the moment any reply was added after the task
            // was created: the header's task chip/button vanished and
            // `moveToSpecificChat`'s `taskExist`-gated `setCurrentPreviewTaskId`
            // never fired (so opening the thread didn't surface its task).
            // Pick the first message that actually carries a task (the root
            // scans first), falling back to the root when there's none.
            const taskMsg =
                threadMessages.find((m) => m.taskExist && m.taskId != null) ?? threadMessages[0];
            const newThread: ThreadProps = {
                chatId: chat.chatId as unknown as number,
                chatName: chat.chatName,
                chatType: chat.chatType,
                dmPartnerUser: chat.dmPartnerUser,
                messages: threadMessages,
                project: taskMsg.project ?? lastThreadMsg.project,
                taskExist: taskMsg.taskExist,
                taskId: taskMsg.taskId,
                threadId: threadRootUuid as unknown as number,
                TSLastMessage: lastThreadMsg.tsSent,
            };
            if (newThread) {
                setCurrentThreadChat(newThread);
                return newThread;
            }
        }
        return null;
    };

    const moveToSpecificChat = async (
        chatType: number,
        chatId: string | number,
        threadId: string | number,
        openTaskNoteInChat: boolean,
        openThreadTaskPreview: boolean,
        setCurrentPreviewTaskId: (id: number) => void,
        setCurrentProject: (project: ProjectProps | null) => void,
        messageId?: string | number,
        // Cross-page "open the task preview ON THE CHAT PAGE" intent.
        // Distinct from the legacy `openThreadTaskPreview` (which four
        // deep-link callers — notification, search/recents, history, the
        // citation chip — already pass `true` and must stay no-ops here):
        // only the task-page "Check Thread" / "openThread" entry points
        // (TaskTitleBlock) set this. Gated on `taskExist` below so a
        // task-less thread never raises it. Defaults false so every
        // existing caller keeps its prior behavior.
        openChatPageTaskPreview: boolean = false
    ) => {
        // Get the URL path for the chat type
        const chatTypePath = CHAT_TYPE_REVERSE_MAP[chatType];
        if (!chatTypePath) {
            console.error(`Invalid chat type: ${chatType}`);
            return;
        }

        // ids may be v3 UUID strings or legacy ints. Treat undefined / 0 /
        // "0" / "" as "absent" — the old `> 0` test wrongly rejected a valid
        // UUID (a UUID string is never `> 0`), which is why chat citation
        // chips couldn't deep-link to a thread / message.
        const isPresent = (v: string | number | undefined): boolean =>
            v !== undefined && v !== null && v !== 0 && v !== "0" && v !== "";
        const threadActive = isPresent(threadId);
        const hasMessage = isPresent(messageId);
        const buildPath = (): string => {
            let path = `/workspace/chat/${chatTypePath}/${chatId}`;
            if (threadActive) path += `/thread/${threadId}`;
            if (hasMessage) path += `/message/${messageId}`;
            return path;
        };

        // Switching to the chat service is implicit: every code path below
        // calls `navigate("/workspace/chat/...")`, and the URL is now the source
        // of truth for the active service (see useGlobalServiceShortcut).
        setIsMainChatVisible(false);
        setIsChatNoteVisibleInChat(openTaskNoteInChat);
        // Reset the chat-page task-preview "open intent" up front. We only
        // honor `openChatPageTaskPreview` once we've confirmed the freshly
        // opened thread actually carries a task (see the taskExist branch
        // below), so the preview can never re-open onto a task-less / stale
        // target. chatHome consumes this flag post-mount.
        setIsThreadTaskVisible(false);

        // PUNCH LIST: `chatId` param is still `number` for the legacy
        // callers; `chat.chatId` is `string` post-v3 flip. We stringify
        // the param for the equality test so tsc accepts it. Once
        // moveToSpecificChat's signature flips to `chatId: string`
        // (and the URL parser stops Number()-ing it), this cast goes.
        const chatIdAsString = String(chatId);
        const targetChat: AllChatProps | undefined = allChats.find(
            (chat) => chat.chatType === chatType && chat.chatId === chatIdAsString
        );

        if (!targetChat) {
            console.error(`Chat not found: chatType=${chatType}, chatId=${chatId}`);
            // Still navigate to the chat page - the routing hook will handle loading
            navigate(buildPath());
            return;
        }

        try {
            // Source flipped from the legacy per-type worker IDB
            // pop (`popSpecificMessages` → 4× per-kind stores) to the
            // v3 unified channelService. The adapter inside
            // `loadV3SpecificMessages` maps v3 Message[] back to legacy
            // MessageProps[] so `defineNewChat` and downstream UI
            // surfaces (MainChatPane, message bubbles, scroll manager)
            // stay shape-compatible.
            const messages = await loadV3SpecificMessages(chatIdAsString, chatType);
            const newChat: ChatProps = defineNewChat(targetChat, messages);
            // Spotlight may have asked us to focus a specific bubble in
            // the main channel. `moveToSpecificIndex` is now the v3
            // message UUID — matches `messageIdWithChatId` on
            // `MessageProps` so `MessageListRenderer.resolveFocusedState`
            // highlights the right row. Resolve the legacy `messageId`
            // (seq, or task id for PM) via the cached snapshot.
            if (hasMessage && !threadActive && messageId !== undefined) {
                const isPm = chatType === 3;
                const resolvedUuid = resolveV3MessageUuid(chatIdAsString, messageId, isPm);
                if (resolvedUuid) newChat.moveToSpecificIndex = resolvedUuid;
            }
            setCurrentMainChat(newChat);

            if (threadActive) {
                const newThread = await moveToSpecificThreadChat(targetChat, threadId);
                if (newThread) {
                    // Set project if the project id exists in the thread messages.
                    if (newThread.project?.projectId) {
                        setCurrentProject(newThread.project);
                    }
                    if (newThread.taskExist === true && newThread.taskId) {
                        setCurrentPreviewTaskId(newThread.taskId);
                        // Honor the caller's "open the task preview on the
                        // chat page" request ONLY now that we know this
                        // thread carries a task and the preview id is fresh.
                        // Scoped to `openChatPageTaskPreview` (NOT the legacy
                        // `openThreadTaskPreview`, which the deep-link callers
                        // pass true) so only the TaskTitleBlock entry points
                        // raise this. chatHome reads this intent post-mount
                        // (the task->chat route swap remounts ChatHome, so its
                        // own false->true transition effect never sees the
                        // flip). The auto-loader in useProjectTaskManagement
                        // loads currentPreviewTask from this id + the
                        // project set by the caller.
                        if (openChatPageTaskPreview) {
                            setIsThreadTaskVisible(true);
                        }
                    }
                    // Re-apply moveToSpecificIndex for thread-message
                    // focus. `moveToSpecificThreadChat` set the thread
                    // without it; we add it here so a Spotlight match
                    // on a thread bubble actually scrolls.
                    if (hasMessage) {
                        // Focus key is the bare v3 reply UUID
                        // (`messageIdWithChatIdAndThreadId` == Message.id), NOT
                        // the legacy `${chatId}-${threadId}-${messageId}`
                        // composite. Search / citation chips pass that UUID
                        // directly; legacy callers pass a numeric seq we
                        // resolve to the reply's UUID within the loaded thread.
                        const focusKey =
                            typeof messageId === "string"
                                ? messageId
                                : newThread.messages.find((m) => Number(m.messageId) === messageId)
                                      ?.messageIdWithChatIdAndThreadId;
                        setCurrentThreadChat({
                            ...newThread,
                            moveToSpecificIndex: focusKey,
                        });
                    }
                }
                setIsMainChatVisible(true);
                setIsThreadVisible(true);
                navigate(buildPath());
            } else {
                setIsMainChatVisible(true);
                navigate(buildPath());
            }
        } catch (error) {
            console.error(error);
            // Still navigate on error to show the chat page
            navigate(buildPath());
        }
    };

    // User-switch reset. The App component doesn't unmount on sign-out
    // (the auth gate just swaps routes), so this hook's `useState`
    // values survive across sign-out → sign-in. Without this effect, a
    // sign-in as a different user would render the previous user's
    // chat list, flagged messages, and open chat. Pairs with
    // `channelService.setCurrentUserId`'s in-memory reset and the
    // sign-in flow's `DatabaseUtils.clearTeamScopedStores`.
    //
    // Also re-triggers the chat-list / flag-list / activity-list loads:
    // the "fire ONCE on mount" effects below don't re-fire on a user
    // switch, and `useServiceInitialization`'s `isLoading=false` effect
    // only fires once too. Without this re-fire the new user lands on
    // an empty workspace until something else triggers a refresh.
    const previousUserIdRef = useRef<string | null>(myself.userId || null);
    useEffect(() => {
        const next = myself.userId || null;
        if (previousUserIdRef.current === next) return;
        const isSwitchAway = previousUserIdRef.current !== null;
        previousUserIdRef.current = next;
        // On a genuine account SWITCH (prev was a real user), wipe the
        // previous user's state so it can't bleed into the new session.
        // On the INITIAL null→user hydration there's nothing to clear —
        // and crucially we must NOT early-return here. The "fire ONCE on
        // mount" effect below runs BEFORE `myself.userId` hydrates from
        // localStorage, so its `loadV3Chats(null)` resolves every DM
        // partner to EMPTY_USER (the chat-list rows render "?"/blank
        // names). The loader re-fire at the end (gated on `next`) is what
        // lands the partner identities once the real userId is available.
        if (isSwitchAway) {
            setAllChats([]);
            setFlaggedMessages([]);
            setActivityMessages([]);
            setCurrentMainChat(undefined);
            setCurrentSubChat(undefined);
            setCurrentThreadChat(undefined);
            setUnReadChatCounts({});
            setUnReadActivityMessageCounts(-1);
            setUnReadChatAndActivityCounts(0);
        }
        // Re-prime from the new user's v3 snapshot once auth is
        // back. If the user just signed out (`next === null`) we
        // intentionally don't re-load — the loaders would fail
        // without a userId and the sign-in screen has nothing to
        // render anyway.
        if (next) {
            void funcSetAllChats();
            void funcSetFlaggedMessages();
            void funcSetActivityMessages();
        }
        // `funcSet*` are defined in this same hook scope and rebind
        // every render — including them in deps would re-fire on
        // every render. Only the userId transition should matter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myself.userId]);

    // Re-fire the loads once the access token actually exists.
    //
    // The effect above keys on `myself.userId` alone, and returns early
    // unless it CHANGED — so it fires exactly once, at userId hydration.
    // But the two inputs land at different times: `myself.userId` comes
    // out of localStorage synchronously, while `accessToken` arrives from
    // an async refresh. So that one shot routinely runs token-less, and
    // `channelService.api()` throws `UNAUTHENTICATED` before any request
    // is made. `loadV3Chats` catches it and returns the IDB-hydrated
    // snapshot instead — which is why the symptom was never an error but
    // a chat list frozen at whatever the LAST good session cached:
    // pre-existing channels rendered fine, and anything created since
    // (a new project's PM channel, hence its task-header icon and note
    // task-pill) was invisible until IDB happened to be refreshed.
    //
    // Ref-guarded so a token ROTATION doesn't re-pull the whole list;
    // only the first null → token transition re-primes. A genuine account
    // switch is still handled by the effect above.
    const primedForTokenRef = useRef(false);
    useEffect(() => {
        if (!accessToken || !myself.userId) return;
        if (primedForTokenRef.current) return;
        primedForTokenRef.current = true;
        void funcSetAllChats();
        void funcSetFlaggedMessages();
        void funcSetActivityMessages();
        // Same rationale as above: `funcSet*` rebind every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, myself.userId]);

    // Initialization Hooks
    useEffect(() => {
        funcSetAllChats();
        funcSetFlaggedMessages();
        funcSetActivityMessages();
        // Intentional: these three loaders fire ONCE on mount. They
        // close over `myself`/`accessToken` already; re-firing on every
        // render would thrash the worker + network.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Live activity-feed refresh. `handleV3Activity` (the socketRouter
    // entry point for `activity.created` socket events) writes the new
    // row to IDB and then dispatches `v3:activity:created` on `window`.
    // Re-derive the React state so the sidebar badge and the activity
    // list tab pick the new entry up without waiting for a page reload.
    //
    // Re-arm on `myself.userId` change: `funcSetActivityMessages` closes
    // over `myself` (used to filter reaction activities by sender id
    // inside the worker). The first render runs before auth resolves so
    // the initial closure has `myself.userId=""` and the worker filter
    // rejects every row. Refreshing the listener whenever the user id
    // changes guarantees the latest closure (with the real userId) is
    // the one that fires.
    useEffect(() => {
        const onActivity = () => {
            void funcSetActivityMessages();
        };
        window.addEventListener("v3:activity:created", onActivity);
        return () => window.removeEventListener("v3:activity:created", onActivity);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myself.userId]);

    useEffect(() => {
        setUnReadChatCounts(countUnreadChats(allChats));
    }, [allChats]);

    useEffect(() => {
        // Exclude the first thread message cause it's actually not a thread message.
        const tmpActivityMessages: ActivityMessageProps[] = activityMessages.filter(
            (item) => !(item.isThread === true && item.messageId === 1)
        );
        setUnReadActivityMessageCounts(countUnreadActivityMessages(tmpActivityMessages));
    }, [activityMessages]);

    useEffect(() => {
        if (unReadChatCounts) {
            // 1: DM, 2: GM, 3: PM
            // Parenthesize each term: `+` binds tighter than `||`, so the
            // old `a || 0 + b || 0 + c || 0` parsed as
            // `a || (0+b) || (0+c) || 0` — an OR-chain that returned the
            // first truthy DM/GM/PM count instead of their sum. Each
            // `(count || 0)` now coalesces before the additions run.
            setUnReadChatAndActivityCounts(
                (unReadChatCounts[1] || 0) +
                    (unReadChatCounts[2] || 0) +
                    (unReadChatCounts[3] || 0) +
                    unReadActivityMessageCounts
            );
        }
    }, [unReadChatCounts, unReadActivityMessageCounts]);

    useEffect(() => {
        const timerId = setTimeout(() => {
            funcSetAllChats();
            if (currentMainChat) {
                // `chatId !== -1` was the legacy "is this a real
                // chat?" sentinel. With chatId now string, empty
                // string is the equivalent of "unset". `chatId` is
                // already a string so `.toString()` is structurally
                // a no-op but kept for clarity.
                if (currentMainChat.chatType === 1 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "1");
                    localStorage.setItem("lastDMChatId", currentMainChat.chatId);
                }
                if (currentMainChat.chatType === 2 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "2");
                    localStorage.setItem("lastGMChatId", currentMainChat.chatId);
                }
                if (currentMainChat.chatType === 3 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "3");
                    localStorage.setItem("lastPMChatId", currentMainChat.chatId);
                }
                if (currentMainChat.chatType === 4 && currentMainChat.chatId !== "") {
                    localStorage.setItem("lastChatType", "4");
                    localStorage.setItem("lastMDMChatId", currentMainChat.chatId);
                }
            }
        }, 500);
        return () => clearTimeout(timerId);
        // Intentional: `funcSetAllChats` is re-derived on every render
        // and isn't memoized; including it in the dep array would re-arm
        // the timer continuously. Only the main/sub chat selection
        // should trigger a refresh.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentMainChat, currentSubChat]);

    // v3 live-update bridge: subscribe to channelService for the
    // currently-open main chat. Whenever a v3 socket event mutates
    // `messagesByChannel` for this channelId (`message.created`,
    // `message.updated`, `message.deleted`, reactions, etc.), we
    // re-adapt the v3 Message[] slice to legacy MessageProps[] and
    // patch `currentMainChat.messages` in place.
    //
    // Replaces the legacy `hooks/common/handlers/message-handlers.ts`
    // dispatch path for the v3 socket events; the legacy handler is
    // still wired for any legacy `/` namespace events the FE still
    // receives during the rewrite window, but the unified path lives
    // here.
    //
    // The `messagesSlice === lastSliceRef` short-circuit relies on
    // channelService returning a new array reference on every mutation
    // (see `_messages.set(channelId, next)` in `handleMessageCreated`),
    // so equal-by-reference means "nothing changed for this channel."
    useEffect(() => {
        const channelId = currentMainChat?.chatId;
        const chatType = currentMainChat?.chatType;
        if (!channelId || chatType == null) return;
        // Track BOTH the messages slice ref and the flags version so a
        // flag-only change (user flags/unflags a bubble in this pane,
        // or another tab does) still triggers a re-adapt — otherwise
        // the bubble's flag icon wouldn't flip until the next message
        // arrives. The `flagByMessageId` Map is mutated in place by
        // channelService, so reference identity can't detect changes;
        // `flagsVersion` bumps on every flag mutation instead.
        let lastSliceRef: readonly unknown[] | undefined;
        let lastFlagsVersion = -1;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            const messagesSlice = snapshot.messagesByChannel.get(channelId);
            if (messagesSlice === lastSliceRef && snapshot.flagsVersion === lastFlagsVersion)
                return;
            lastSliceRef = messagesSlice;
            lastFlagsVersion = snapshot.flagsVersion;
            if (!messagesSlice) return;
            const legacyMessages = v3MessagesToLegacy({
                channelId,
                chatType,
                flaggedMessageIds: snapshot.flagByMessageId,
                messages: messagesSlice,
            });
            setCurrentMainChat((prev) => {
                // Guard against a chat-switch race: by the time the
                // notification fires, the user may have navigated to a
                // different channel. Only patch if the chat that was
                // open when this effect armed is still open.
                if (!prev || prev.chatId !== channelId) return prev;
                return { ...prev, messages: legacyMessages };
            });
        };
        // Subscribe first; channelService runs the callback on every
        // mutation. Re-apply once synchronously in case events landed
        // between the `moveToSpecificChat` REST resolution and this
        // effect arming.
        const unsubscribe = channelService.subscribe(apply);
        apply();
        return unsubscribe;
    }, [currentMainChat?.chatId, currentMainChat?.chatType]);

    // Sub-pane mirror of the above. SubChatPane renders an independent
    // chat in the side pane (e.g. a peek opened from Spotlight or the
    // activity sidebar) — its messages need the same v3 live-update
    // bridge as the main pane so a socket-delivered new message is
    // reflected in both panes when the same channel is open in each.
    useEffect(() => {
        const channelId = currentSubChat?.chatId;
        const chatType = currentSubChat?.chatType;
        if (!channelId || chatType == null) return;
        let lastSliceRef: readonly unknown[] | undefined;
        let lastFlagsVersion = -1;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            const messagesSlice = snapshot.messagesByChannel.get(channelId);
            if (messagesSlice === lastSliceRef && snapshot.flagsVersion === lastFlagsVersion)
                return;
            lastSliceRef = messagesSlice;
            lastFlagsVersion = snapshot.flagsVersion;
            if (!messagesSlice) return;
            const legacyMessages = v3MessagesToLegacy({
                channelId,
                chatType,
                flaggedMessageIds: snapshot.flagByMessageId,
                messages: messagesSlice,
            });
            setCurrentSubChat((prev) => {
                if (!prev || prev.chatId !== channelId) return prev;
                return { ...prev, messages: legacyMessages };
            });
        };
        const unsubscribe = channelService.subscribe(apply);
        apply();
        return unsubscribe;
    }, [currentSubChat?.chatId, currentSubChat?.chatType]);

    // Thread-pane mirror of the above. When the user has a thread
    // open and a new reply lands via WS, v3 channelService writes it
    // into the channel's `messagesByChannel` slice (thread replies
    // sit alongside top-level rows, distinguished by `isThreadReply`
    // + `parentId`). Filter to the open thread's root, re-adapt to
    // legacy `ThreadMessageProps[]`, patch `currentThreadChat.messages`.
    //
    // `currentThreadChat.chatId` and `currentThreadChat.threadId` are
    // typed `number` but carry the v3 UUIDs via the migration cast —
    // stringify defensively before consuming.
    useEffect(() => {
        const channelUuid = currentThreadChat?.chatId ? String(currentThreadChat.chatId) : null;
        const threadRootUuid = currentThreadChat?.threadId
            ? String(currentThreadChat.threadId)
            : null;
        const chatType = currentThreadChat?.chatType;
        if (!channelUuid || !threadRootUuid || chatType == null) return;
        let lastSliceRef: readonly unknown[] | undefined;
        let lastFlagsVersion = -1;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            const messagesSlice = snapshot.messagesByChannel.get(channelUuid);
            if (messagesSlice === lastSliceRef && snapshot.flagsVersion === lastFlagsVersion)
                return;
            lastSliceRef = messagesSlice;
            lastFlagsVersion = snapshot.flagsVersion;
            if (!messagesSlice) return;
            const legacyThreadMessages = v3ThreadMessagesToLegacy({
                channelId: channelUuid,
                chatType,
                flaggedMessageIds: snapshot.flagByMessageId,
                messages: messagesSlice,
                threadRootUuid,
            });
            setCurrentThreadChat((prev) => {
                if (!prev) return prev;
                // Guard against a thread-switch race — only patch if
                // the thread that was open when this effect armed is
                // still open.
                if (String(prev.chatId) !== channelUuid) return prev;
                if (String(prev.threadId) !== threadRootUuid) return prev;
                return { ...prev, messages: legacyThreadMessages };
            });
        };
        const unsubscribe = channelService.subscribe(apply);
        apply();
        return unsubscribe;
    }, [currentThreadChat?.chatId, currentThreadChat?.threadId, currentThreadChat?.chatType]);

    // Flagged-messages sidebar subscription. The legacy `popFlaggedMessages`
    // path read from a per-user IDB store seeded by the legacy `/chat/master/`
    // flag endpoint; v3 flags broadcast to `user:{userId}` and land in
    // `channelService.snapshot.flags`. Derive `flaggedMessages` from that
    // map + the cached `messagesByChannel` so flags toggled anywhere in
    // the app (any tab, any bubble menu) refresh the sidebar list
    // automatically without a manual `funcSetFlaggedMessages()` call.
    //
    // The legacy initial-load + the legacy chat-master endpoint stay in
    // place for back-compat — they no longer overwrite the v3-derived
    // list because this effect re-applies on every channelService notify.
    useEffect(() => {
        // Dedup on the monotonic `version` counter: it bumps on every
        // notify, including ones that mutate `_flags` / `_messages` in
        // place (their Map references never change). `flagsVersion`
        // alone would miss the "message arrives → previously-orphaned
        // flag now resolves" edge case, since `v3FlagsToLegacy` reads
        // `messagesByChannel` too. Cost is one `v3FlagsToLegacy()` per
        // notify; flag count is small, negligible.
        let lastVersion = -1;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            if (snapshot.version === lastVersion) return;
            lastVersion = snapshot.version;
            const common = {
                flags: snapshot.flags,
                channels: snapshot.channels,
                membersByChannel: snapshot.membersByChannel,
                messagesByChannel: snapshot.messagesByChannel,
                currentUserId: myself.userId || null,
            };
            setFlaggedMessages(v3FlagsToLegacy({ ...common, filter: "active" }));
            setPastFlaggedMessages(v3FlagsToLegacy({ ...common, filter: "completed" }));
        };
        const unsubscribe = channelService.subscribe(apply);
        apply();
        return unsubscribe;
        // `myself.userId` is the only external input — re-arm if the
        // signed-in user changes (rare; covers re-login flows).
    }, [myself.userId]);

    // Chat-list sidebar subscription. `allChats` was previously seeded
    // by the one-shot `funcSetAllChats()` call on mount and refreshed
    // only when the user opened a different chat — so a read-cursor
    // advance from `handleReadAdvanced` (which mutates `_channels[id].
    // unreadCount` in place) never reached the sidebar badge. Subscribe
    // to channelService and re-derive on every notify so the unread
    // counts stay live.
    useEffect(() => {
        let lastVersion = -1;
        const apply = () => {
            const snapshot = channelService.getSnapshot();
            if (snapshot.version === lastVersion) return;
            lastVersion = snapshot.version;
            const next = v3ChannelsToLegacyChats({
                channels: snapshot.channels.values(),
                pinByChannelId: snapshot.pinByChannelId,
                membersByChannel: snapshot.membersByChannel,
                currentUserId: myself.userId || null,
            });
            setAllChats(next);
        };
        const unsubscribe = channelService.subscribe(apply);
        apply();
        return unsubscribe;
    }, [myself.userId]);

    // Keys sorted natural-case-insensitive ascending per the project's
    // `sort-keys` lint rule. Grouping comments (visibility / chat data
    // / etc.) lived above; the sorted shape is intentionally flat.
    return {
        activityMessages,
        allChats,
        currentChatPaneType,
        currentMainChat,
        currentSubChat,
        currentThreadChat,
        defineNewChat,
        flaggedMessages,
        funcSetActivityMessages,
        funcSetAllChats,
        funcSetFlaggedMessages,
        funcSetPastFlaggedMessages,
        isChatNoteVisibleInChat,
        isMainChatVisible,
        isSubChatVisible,
        isThreadTaskVisible,
        isThreadVisible,
        moveToSpecificChat,
        moveToSpecificThreadChat,
        notMoveChatPaneType,
        pastFlaggedMessages,
        setActivityMessages,
        setAllChats,
        setCurrentChatPaneType,
        setCurrentMainChat,
        setCurrentSubChat,
        setCurrentThreadChat,
        setFlaggedMessages,
        setPastFlaggedMessages,
        setIsChatNoteVisibleInChat,
        setIsMainChatVisible,
        setIsSubChatVisible,
        setIsThreadTaskVisible,
        setIsThreadVisible,
        setNotMoveChatPaneType,
        setShowOnlyInCompleteTodos,
        setUnReadActivityMessageCounts,
        setUnReadChatAndActivityCounts,
        setUnReadChatCounts,
        showOnlyInCompleteTodos,
        unReadActivityMessageCounts,
        unReadChatAndActivityCounts,
        unReadChatCounts,
    };
};
