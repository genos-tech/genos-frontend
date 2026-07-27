// `sort-keys` + `react/jsx-sort-props` disabled file-wide: this 660+
// line legacy activity list item carries ~45 violations in Joy UI
// `sx` prop objects and prop lists whose visual grouping is intentional
// and not worth re-sorting given the surface is legacy chat code
// slated for replacement by the v3 channel UI. `simple-import-sort`
// disabled because the prettier import-sort plugin disagrees with it
// on react-vs-@mui ordering.
/* eslint-disable react/jsx-sort-props */
import * as React from "react";
import { Box, ListDivider, ListItem, Stack, Typography } from "@mui/joy";
import ListItemButton from "@mui/joy/ListItemButton";
import { useColorScheme } from "@mui/joy/styles";
import { useNavigate } from "react-router-dom";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../../context/AuthContext";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../../../hooks/tasks/useTaskManagement";
import { fmt, useTranslation } from "../../../../../i18n";
import { channelService } from "../../../../../services/channel/channelService";
import { UserProps } from "../../../../../types/admin";
import {
    ActivityMessageProps,
    AllChatProps,
    ChatProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../../types/chat";
import { ChatNoteProps, MyNoteProps, TaskNoteProps } from "../../../../../types/notes";
import { ProjectProps, TaskProps } from "../../../../../types/tasks";
import { getLocalCurrentTimestamp } from "../../../../../utils/dateUtils";
import { toggleMessagesPane } from "../../../../../utils/sidebarUtils";
import { loadSpecificNote } from "../../../../notes/common/services/loadSpecificNote";
import { loadSpecificTask } from "../../../../tasks/services/loadSpecificTask";
import { useActivityStatus } from "../../../hooks/useActivityStatus";
import {
    loadV3SpecificMessages,
    readV3CachedMessages,
} from "../../../services/loadV3SpecificMessages";
import {
    loadV3SpecificThreadMessages,
    readV3CachedThreadMessages,
} from "../../../services/loadV3SpecificThreadMessages";
import { AggregatedActivityMessage } from "../../../utils/activityAggregation";
import { resolveV3ThreadRootUuid } from "../../../utils/channelIdResolvers";
import { ActivityContent } from "./ActivityContent";
import { ActivityHeader } from "./ActivityHeader";

// chatType = {1: DM, 2: GM, 3: PM, 4: Task-comment OR MDM}
//   chat_type=4 is dual-purpose: task-comment activities carry a `taskId`
//   (and `chatId === project_id`), MDM activities don't (`chatId === mdm_id`).
// activityType = {1: message or comment, 2: reaction, 3: mention}

// Activity type color schemes for visual distinction
const ACTIVITY_COLOR_SCHEMES = {
    reply: { dark: "#4ade80", light: "#22c55e" },
    reaction: { dark: "#fbbf24", light: "#f59e0b" },
    mention: { dark: "#f87171", light: "#ef4444" },
    default: { dark: "var(--gp-brandalt-400)", light: "var(--gp-brand-700)" },
} as const;

type ChatListItemForActivityProps = {
    activity: ActivityMessageProps;
    activityMessages: ActivityMessageProps[];
    myself: UserProps;
    selectedActivityId: string;
    setCurrentProject: (value: ProjectProps) => void;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    setSelectedActivityId: (value: string) => void;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
    useTM: TaskManagementState;
    // Optional — only needed for click-through into note mentions
    // (chat_type 6/7/8). Activities from chat / task / task-comment
    // surfaces don't touch it.
    useNM?: NoteManagementState;
};

export const ChatListItemForActivity = (props: ChatListItemForActivityProps) => {
    const {
        useTEM,
        selectedActivityId,
        setSelectedActivityId,
        socket,
        activity,
        activityMessages,
        myself,
        setMyself,
        useUISM,
        setCurrentProject,
        useCM,
        useTM,
        useNM,
    } = props;

    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const { accessToken } = useAuth();
    const { t } = useTranslation();
    const navigate = useNavigate();

    const { groupedReactions, updateActivityReadStatus } = useActivityStatus({
        activity,
        activityMessages,
        useCM,
        myself,
        accessToken,
    });

    const isYou = myself.userId === activity.dmPartnerUserId;
    const isSelected = selectedActivityId === activity.activityId;

    // Same-topic aggregation: the feed hands us the LATEST activity of a
    // topic annotated with how many rows it stands in for (see
    // `activityAggregation.ts`). >1 means earlier same-topic activities
    // are collapsed behind this row — surface that so the burst isn't
    // silently invisible. Clicking the row marks the whole group read
    // (handled in `useActivityStatus`).
    const aggregatedCount = (activity as Partial<AggregatedActivityMessage>).aggregatedCount ?? 1;

    // Get color scheme based on activity type
    const getActivityColor = () => {
        switch (activity.activityType) {
            case 1:
                return ACTIVITY_COLOR_SCHEMES.reply;
            case 2:
                return ACTIVITY_COLOR_SCHEMES.reaction;
            case 3:
                return ACTIVITY_COLOR_SCHEMES.mention;
            // activityType 5 = plain message (ActivityType.MESSAGE) — same
            // green "message/reply" family as a thread reply (type 1).
            case 5:
                return ACTIVITY_COLOR_SCHEMES.reply;
            default:
                return ACTIVITY_COLOR_SCHEMES.default;
        }
    };

    const activityColor = getActivityColor();

    // For task-comment activities (chat_type=4 + taskId truthy), the actual
    // chat is the underlying PM (chat_type=3) — clicking the activity opens
    // the project chat. MDM activities (chat_type=4 without taskId) are
    // their own chats and must NOT be remapped to PM.
    const isTaskComment = activity.chatType === 4 && !!activity.taskId;
    // Task-body mentions (chat_type=5, post-1D) — `chat_id = project_id`
    // and `task_id` is set. Click opens the task preview, no chat hop.
    const isTaskBody = activity.chatType === 5;
    // Note-mention chat-types reserved by the activity-id namespace
    // (6=Personal, 7=Task, 8=Chat). The fan-out routes by `mentionedUserIds`
    // so this branch only ever fires for notes the user is mentioned in.
    const NOTE_CHAT_TYPE_TO_NOTE_TYPE: Record<number, 1 | 2 | 3> = {
        6: 1,
        7: 2,
        8: 3,
    };
    const noteTypeForActivity = NOTE_CHAT_TYPE_TO_NOTE_TYPE[activity.chatType];

    // chatType → URL path segment. Mirrors `MessageBubble.handleMessageClick`
    // so activity-click navigation lands on the same canonical URL the
    // chat-list click does — that's what `useChatRouting` watches to
    // resolve focus through `resolveV3MessageUuid`.
    const CHAT_TYPE_PATH: Record<number, string> = {
        1: "dm",
        2: "gm",
        3: "pm",
        4: "mdm",
    };

    const defineNewChat = (
        messages: MessageProps[],
        moveToSpecificIndex: string,
        v3ChannelUuid?: string
    ) => {
        const chatType: number = isTaskComment ? 3 : activity.chatType;
        // v3-shape callers pass the resolved v3 channel UUID so the
        // built `ChatProps` keys into `allChats` (UUID-keyed via
        // `loadV3Chats`) and downstream `channelService.send` doesn't
        // 404 against a legacy int. Falls back to the legacy int when
        // not provided.
        const activityChatIdStr = v3ChannelUuid ?? String(activity.chatId);
        const currentChat: AllChatProps = useCM.allChats.filter(
            (chat) => chat.chatType === chatType && chat.chatId === activityChatIdStr
        )[0];
        // For DMs (and MDMs) the activity payload's `chatName` / `dmPartnerUser*`
        // are sender-centric: the sender's UI passes their own view of the
        // chat name as `destCGName`, and the backend sets `dmPartnerUser =
        // sender`. From the receiver's POV both are wrong. `currentChat`
        // (from `useCM.allChats`) is server-resolved per-user, so prefer it
        // whenever it's available — fall back to the activity payload only
        // when allChats hasn't synced yet.
        // `lastReadMessageId` is `string` post-flip; compare-as-numbers
        // for legacy stringified ints, fall back to the activity's
        // messageId on first read. NaN-on-UUID lands on the activity
        // side, which is the safer side of the migration gap.
        const previousLastRead = Number(currentChat?.lastReadMessageId || "0");
        const nextLastRead = Number.isFinite(previousLastRead)
            ? Math.max(previousLastRead, activity.messageId)
            : activity.messageId;
        // Cold-cache guard: `readV3CachedMessages` returns `[]` for a
        // channel that's never been synced this session, so the old
        // `messages[messages.length - 1].contentText` would throw on the
        // instant-paint path. Fall back to the sidebar chat's last-message
        // fields (mirrors `useChatListItem.defineNewChat`); both panes
        // render a neutral blank for empty `messages` and the background
        // sync fills them in via the live-update subscription.
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : undefined;
        const newChat: ChatProps = {
            chatId: activityChatIdStr,
            chatName: currentChat?.chatName ?? activity.chatName,
            chatType: chatType,
            dmPartnerUser: currentChat?.dmPartnerUser ?? {
                teamId: myself.teamId,
                teamName: myself.teamName,
                userId: activity.dmPartnerUserId,
                userName: activity.dmPartnerUserName,
                userEmail: activity.dmPartnerUserEmail,
                avatarImgPath: "",
                tsLastSeen: "",
                tsJoined: "",
            },
            lastReadMessageId: String(nextLastRead),
            messages: messages,
            latestMessage: lastMsg ?? currentChat?.latestMessage,
            latestMessageText: lastMsg?.contentText ?? currentChat?.latestMessageText,
            TSLastMessage: activity.tsSent,
            moveToSpecificIndex: moveToSpecificIndex,
            isPrivate: currentChat?.isPrivate,
            profileImagePath: currentChat?.profileImagePath,
        };
        return newChat;
    };

    // Helper function to handle common chat navigation logic.
    //
    // Hot path: paint the pane INSTANTLY from the in-memory snapshot
    // (`readV3CachedMessages`) rather than awaiting `loadV3SpecificMessages`
    // — which awaits a ~1s `syncChannel` REST round-trip — before the chat
    // is ever shown. That await was the bulk of the "click an activity, stare
    // at a frozen pane for 1-2s" lag. We now paint cached messages
    // immediately and revalidate in the background; the `useChatManagement`
    // live-update subscription patches the fresh slice into the open main/sub
    // pane once the sync resolves. Mirrors `useChatListItem.onClickHandler`,
    // the pattern the normal chat-list click already uses.
    const handleChatNavigation = (
        chatType: number,
        isThread: boolean,
        messageUniqueKey: string
    ) => {
        const shouldUseMainChat =
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${activity.chatId}-${activity.chatName}`;

        const shouldUseSubChat =
            useCM.isSubChatVisible === true ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` ===
                `${activity.chatId}-${activity.chatName}`;

        // Post v3 activity rebuild: `activity.chatId` is already the
        // v3 Channel UUID (the adapter casts it through the legacy
        // `number` slot). No legacy-int → UUID resolution needed.
        const v3ChannelUuid = String(activity.chatId);
        if (!v3ChannelUuid) {
            return;
        }

        toggleMessagesPane();

        // Instant paint from cache — no network wait. `[]` on a cold cache
        // is benign: both panes render a neutral blank and the background
        // sync below fills them in.
        const messages = readV3CachedMessages(v3ChannelUuid, chatType);
        if (shouldUseMainChat) {
            useCM.setCurrentMainChat(defineNewChat(messages, messageUniqueKey, v3ChannelUuid));
        } else if (shouldUseSubChat) {
            useCM.setCurrentSubChat(defineNewChat(messages, messageUniqueKey, v3ChannelUuid));
        }
        useCM.setIsMainChatVisible(true);
        if (useTM.isCreatingTask.flag === true || useTM.isTaskPreviewVisible) {
            useCM.setIsThreadVisible(false);
        }

        // Sync the URL so `useChatRouting` picks the focus target up
        // through `resolveV3MessageUuid` — that path is what the
        // legacy chat-list click already used and what the bubble
        // renderer's `focusKey` ultimately reads. Without this nav,
        // an activity click in a chat that's already open updates
        // `moveToSpecificIndex` via the local `setCurrentMainChat`
        // but a later URL-driven sync can clobber it; for PM the
        // URL `messageId` segment is the task id (matches
        // `MessageBubble.handleMessageClick`).
        const typePath = CHAT_TYPE_PATH[chatType];
        const idForUrl = chatType === 3 && activity.taskId ? activity.taskId : activity.messageId;
        if (typePath && idForUrl && !isThread) {
            navigate(`/workspace/chat/${typePath}/${v3ChannelUuid}/message/${idForUrl}`);
        }

        // Background revalidate. `syncChannel` pulls top-level AND thread
        // replies, is idempotent + per-channel mutexed, and the subscription
        // applies the result to whichever pane(s) are open — so a thread
        // caller doesn't need a second sync of its own.
        void channelService
            .syncChannel(v3ChannelUuid)
            .catch((error) =>
                console.error("[chatListItemForActivity] background syncChannel failed:", error)
            );
    };

    // Load the thread task if exists
    const loadTask = () => {
        (async () => {
            if (activity.projectId && activity.taskId) {
                const loadedTask: TaskProps[] = await loadSpecificTask(
                    myself,
                    activity.projectId,
                    activity.taskId,
                    accessToken
                );
                if (loadedTask.length > 0) {
                    useTM.setCurrentPreviewTask(loadedTask[0]);
                }
            }
        })();
    };

    // Handle task comment activity — opens the PM chat AND the task's
    // comment thread (mirrors MessageBubble.replayHandler). ThreadChatPane
    // defaults to the "comments" tab for PM threads with a valid taskId,
    // which surfaces ThreadCommentsView with the task's comments.
    const handleTaskCommentActivity = async () => {
        const shouldUseMainChat =
            useCM.isSubChatVisible === false ||
            `${useCM.currentSubChat?.chatId}-${useCM.currentSubChat?.chatName}` !==
                `${activity.chatId}-${activity.chatName}`;

        if (shouldUseMainChat) {
            toggleMessagesPane();
            try {
                // v3-native: activity.chatId IS the PM channel UUID.
                const v3ChannelUuid = String(activity.chatId);
                if (!v3ChannelUuid) {
                    return;
                }
                const messages = await loadV3SpecificMessages(v3ChannelUuid, 3);
                useCM.setCurrentMainChat(
                    defineNewChat(messages, activity.messageUniqueKey, v3ChannelUuid)
                );

                if (activity.projectId) {
                    setCurrentProject({
                        projectId: activity.projectId,
                        projectName: activity.projectName || "",
                        projectTags: [],
                    });
                }

                useCM.setIsMainChatVisible(true);
                useTM.setIsCreatingTask((prev) => ({ ...prev, flag: false }));
                useTM.setIsTaskPreviewVisible(false);

                if (activity.taskId) {
                    loadTask();
                    useTM.setCurrentPreviewTaskId(activity.taskId);

                    // PM thread root: the message whose `taskId === activity.taskId`.
                    // `activity.chatId` is the v3 PM Channel UUID directly.
                    const v3ChannelUuid = String(activity.chatId);
                    const v3ThreadRootUuid = v3ChannelUuid
                        ? resolveV3ThreadRootUuid(v3ChannelUuid, activity.taskId, true)
                        : null;
                    const threadMessages: ThreadMessageProps[] =
                        v3ChannelUuid && v3ThreadRootUuid
                            ? await loadV3SpecificThreadMessages(
                                  v3ChannelUuid,
                                  v3ThreadRootUuid,
                                  3
                              )
                            : [];

                    if (threadMessages && threadMessages.length > 0) {
                        const newThread: ThreadProps = {
                            chatId: activity.chatId,
                            chatName: activity.chatName,
                            threadId: activity.taskId,
                            chatType: 3,
                            dmPartnerUser: {
                                teamId: myself.teamId,
                                teamName: myself.teamName,
                                userId: activity.dmPartnerUserId,
                                userName: activity.dmPartnerUserName,
                                userEmail: activity.dmPartnerUserEmail,
                                avatarImgPath: "",
                                tsLastSeen: "",
                                tsJoined: "",
                            },
                            taskId: activity.taskId,
                            messages: threadMessages,
                            project: {
                                projectId: activity.projectId || activity.chatId,
                                projectName: activity.projectName || "",
                                projectTags: [],
                            },
                            TSLastMessage: getLocalCurrentTimestamp(),
                            taskExist: threadMessages[0].taskExist,
                        };
                        useCM.setCurrentThreadChat(newThread);
                    }

                    // Deep-link to the specific comment so TaskCommentBubble
                    // picks up the focused tint. activity.messageId IS the
                    // commentId for task-comment activities (set from
                    // response["comment_id"] on the backend).
                    navigate(
                        `/workspace/chat/pm/${activity.chatId}/thread/${activity.taskId}/comment/${activity.messageId}`
                    );
                }
                useCM.setIsThreadVisible(true);
            } catch (error) {
                console.error(error);
            }
        }
    };

    // Handle thread message activity. Hot path mirrors `handleChatNavigation`:
    // paint the thread pane from the in-memory snapshot
    // (`readV3CachedThreadMessages`) instead of awaiting a `syncChannel`
    // round-trip, then let `handleChatNavigation` issue the SINGLE background
    // revalidate (which pulls top-level AND thread replies). Previously this
    // awaited a thread sync AND then `handleChatNavigation` awaited a second
    // sync of the same channel — two sequential ~1s round-trips before
    // anything showed. The `useChatManagement` thread subscription patches
    // fresh replies into `currentThreadChat.messages` once that one sync
    // resolves.
    const handleThreadMessageActivity = () => {
        try {
            // v3-native: activity.chatId is the v3 Channel UUID, and
            // activity.threadId is the v3 parent-message UUID (set by
            // the v3 → legacy activity adapter for non-PM kinds). For
            // PM, `threadId` is still the task id (legacy seq-key);
            // the resolver disambiguates via `isPm`.
            const v3ChannelUuid = String(activity.chatId);
            const v3ThreadRootUuid =
                activity.chatType === 3
                    ? v3ChannelUuid
                        ? resolveV3ThreadRootUuid(v3ChannelUuid, activity.taskId, true)
                        : null
                    : String(activity.threadId) || null;
            const threadMessages: ThreadMessageProps[] =
                v3ChannelUuid && v3ThreadRootUuid
                    ? readV3CachedThreadMessages(
                          v3ChannelUuid,
                          v3ThreadRootUuid,
                          activity.chatType
                      )
                    : [];

            // Same sender-centric issue as in `defineNewChat`: for DM
            // threads the activity payload's chatName + dmPartnerUser*
            // are wrong from the receiver's POV. Prefer the server-
            // resolved per-user fields from `useCM.allChats`.
            // Same v3 chatId boundary as above — see note in
            // `defineNewChat`.
            const currentChat: AllChatProps | undefined = useCM.allChats.find(
                (chat) =>
                    chat.chatType === activity.chatType && chat.chatId === String(activity.chatId)
            );
            // Build + set the shell UNCONDITIONALLY (tolerating an empty
            // cold-cache slice via the `?.` guards below) so the thread
            // subscription can patch in the replies once the background sync
            // resolves — matching the old await-then-show behavior without
            // the wait. The legacy thread pane renders a neutral blank for
            // an empty `messages` array.
            const newThread: ThreadProps = {
                chatId: activity.chatId,
                chatName: currentChat?.chatName ?? activity.chatName,
                threadId: activity.threadId,
                chatType: activity.chatType,
                dmPartnerUser: currentChat?.dmPartnerUser ?? {
                    teamId: myself.teamId,
                    teamName: myself.teamName,
                    userId: activity.dmPartnerUserId,
                    userName: activity.dmPartnerUserName,
                    userEmail: activity.dmPartnerUserEmail,
                    avatarImgPath: "",
                    tsLastSeen: "",
                    tsJoined: "",
                },
                taskId: activity.taskId,
                messages: threadMessages,
                project: {
                    projectId: activity.projectId || -1,
                    projectName: activity.projectName || "",
                    projectTags: [],
                },
                TSLastMessage: getLocalCurrentTimestamp(),
                taskExist: threadMessages[0]?.taskExist ?? false,
                moveToSpecificIndex: activity.threadMessageUniqueKey,
            };

            if (activity.projectId) {
                setCurrentProject({
                    projectId: activity.projectId,
                    projectName: activity.projectName || "",
                    projectTags: [],
                });
            }

            useCM.setCurrentThreadChat(newThread);
            if (newThread.taskExist === true && threadMessages[0]?.taskId) {
                useTM.setCurrentPreviewTaskId(threadMessages[0].taskId);
            }

            // Paint the main pane instantly + issue the one background sync
            // that also revalidates this thread's replies.
            handleChatNavigation(activity.chatType, activity.isThread, activity.messageUniqueKey);

            useCM.setIsThreadVisible(true);
        } catch (error) {
            console.error(error);
        }
    };

    // Open a task body whose body was mentioned (chat_type=5). Mirrors
    // the task-comment open flow but stops at the task preview; there's
    // no comment-thread hop because the mention lives in the task body
    // itself.
    const handleTaskBodyActivity = async () => {
        if (!activity.projectId || !activity.taskId) return;
        setCurrentProject({
            projectId: activity.projectId,
            projectName: activity.projectName || "",
            projectTags: [],
        });
        const loadedTask: TaskProps[] = await loadSpecificTask(
            myself,
            activity.projectId,
            activity.taskId,
            accessToken
        );
        if (loadedTask.length > 0) {
            useTM.setCurrentPreviewTask(loadedTask[0]);
            useTM.setCurrentPreviewTaskId(activity.taskId);
            useTM.setIsTaskPreviewVisible(true);
        }
    };

    // Open a note whose body mentioned the user (chat_type=6/7/8). The
    // activity payload only carries the note_id (packed as `chat_id`),
    // so we fetch the full note to recover the deep-link coordinates
    // for task / chat notes. A 403 from the fetch means the user was
    // mentioned but no longer has access — surface a console warning
    // and bail (matching chat-mention behaviour on revoked access).
    const handleNoteActivity = async () => {
        if (!useNM || !noteTypeForActivity) return;
        const noteId = activity.chatId;
        const fetched = await loadSpecificNote(myself, noteTypeForActivity, noteId, accessToken);
        // Bail on any non-note result: `undefined` (load failure) OR the
        // `{ error: "forbidden" }` 403 marker — the latter is truthy, so
        // a `!fetched`-only guard would set the marker as a fake note.
        if (!fetched || fetched.error) {
            return;
        }
        if (noteTypeForActivity === 1) {
            useNM.setCurrentNoteType(1);
            useNM.setCurrentMyNote(fetched as MyNoteProps);
            navigate(`/workspace/notes/my/${noteId}`);
            return;
        }
        if (noteTypeForActivity === 2) {
            const note = fetched as TaskNoteProps;
            useNM.setCurrentNoteType(2);
            useNM.setCurrentTaskNote(note);
            if (note.projectId && note.taskId) {
                navigate(
                    `/workspace/notes/task/project/${note.projectId}` +
                        `/task/${note.taskId}/note/${noteId}`
                );
            } else {
                navigate("/workspace/notes");
            }
            return;
        }
        if (noteTypeForActivity === 3) {
            const note = fetched as ChatNoteProps;
            useNM.setCurrentNoteType(3);
            useNM.setCurrentChatNote(note);
            const chatTypePath = ["", "dm", "gm", "pm", "mdm"][note.chatType] ?? null;
            if (chatTypePath && note.chatId && note.threadId !== undefined) {
                navigate(
                    `/workspace/notes/chat/${chatTypePath}` +
                        `/${note.chatId}/thread/${note.threadId}/note/${noteId}`
                );
            } else {
                navigate("/workspace/notes");
            }
        }
    };

    const onClickHandler = async () => {
        // set to true to not move chat pane type
        useCM.setNotMoveChatPaneType(true);

        setSelectedActivityId(activity.activityId);

        if (noteTypeForActivity) {
            // Note mention — chat_type 6/7/8 routes into the notes
            // workspace, no chat navigation involved.
            await handleNoteActivity();
        } else if (isTaskBody) {
            // Task-body mention — open the task preview directly.
            await handleTaskBodyActivity();
        } else if (activity.isThread === false) {
            if (isTaskComment) {
                // Handling a task-comment activity (chat_type=4 + taskId)
                await handleTaskCommentActivity();
            } else {
                // Handling a message activity in DM, GM, PM, or MDM
                // (MDM = chat_type=4 without taskId — same nav flow as
                // regular chats, just the chat lives under chat_type=4 in
                // allChats). Synchronous now — paints from cache + background
                // sync, so `updateActivityReadStatus()` below fires right
                // after the instant paint rather than after a network wait.
                handleChatNavigation(
                    activity.chatType,
                    activity.isThread,
                    activity.messageUniqueKey
                );
            }
        } else {
            // Handling a thread message (synchronous instant paint).
            handleThreadMessageActivity();
        }

        if (activity.isRead === false) {
            updateActivityReadStatus();
        }
    };

    // Surface labels rendered as the right-most chip in `ActivityTypeChips`.
    // 1-4 are the user-facing chat types. 5-8 are activity-id namespaces
    // for the @mention surfaces that aren't chats at all (task body +
    // three note types) — see activity_views.py docstring. `chat_type=4`
    // is dual-purpose (task comment vs MDM) and is special-cased in
    // ActivityTypeChips via the `taskId` discriminator.
    const chatTypeLookup: { [key: number]: string } = {
        1: "DM",
        2: "GM",
        3: "PM",
        // chat_type=4 is dual-purpose: with a taskId it's a task comment
        // (ActivityTypeChips overrides via `taskId` check); without one it's
        // a multi-user DM, which to end users is just a "DM" — "MDM" is
        // internal terminology only.
        4: "DM",
        5: t.chat.activity.chipTaskBody,
        6: t.chat.activity.chipPersonalNote,
        7: t.chat.activity.chipTaskNote,
        8: t.chat.activity.chipChatNote,
    };

    return (
        <React.Fragment>
            <ListItem
                sx={{
                    width: "100%",
                    p: 0.5,
                    overflowX: "hidden",
                }}
            >
                <ListItemButton
                    data-chat-list-key={`activity-${activity.activityId}`}
                    onClick={onClickHandler}
                    sx={{
                        flexDirection: "column",
                        alignItems: "initial",
                        gap: 0.75,
                        py: 1.25,
                        px: 1.5,
                        borderRadius: "12px",
                        position: "relative",
                        overflow: "hidden",
                        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                        background: isSelected
                            ? isDark
                                ? `linear-gradient(135deg, ${activityColor.dark}15 0%, ${activityColor.dark}08 100%)`
                                : `linear-gradient(135deg, ${activityColor.light}12 0%, ${activityColor.light}05 100%)`
                            : isDark
                              ? "rgba(255,255,255,0.02)"
                              : "rgba(0,0,0,0.01)",
                        border: "1px solid",
                        borderColor: isSelected
                            ? isDark
                                ? `${activityColor.dark}30`
                                : `${activityColor.light}25`
                            : isDark
                              ? "rgba(255,255,255,0.04)"
                              : "rgba(0,0,0,0.04)",
                        boxShadow: isSelected
                            ? isDark
                                ? `0 4px 16px ${activityColor.dark}15, inset 0 1px 0 ${activityColor.dark}10`
                                : `0 4px 16px ${activityColor.light}12, inset 0 1px 0 ${activityColor.light}08`
                            : "none",
                        "&:hover": {
                            background: isSelected
                                ? isDark
                                    ? `linear-gradient(135deg, ${activityColor.dark}20 0%, ${activityColor.dark}12 100%)`
                                    : `linear-gradient(135deg, ${activityColor.light}15 0%, ${activityColor.light}08 100%)`
                                : isDark
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(0,0,0,0.03)",
                            borderColor: isSelected
                                ? isDark
                                    ? `${activityColor.dark}40`
                                    : `${activityColor.light}35`
                                : isDark
                                  ? "rgba(255,255,255,0.08)"
                                  : "rgba(0,0,0,0.08)",
                            transform: "translateY(-1px)",
                            boxShadow: isSelected
                                ? isDark
                                    ? `0 6px 20px ${activityColor.dark}20`
                                    : `0 6px 20px ${activityColor.light}15`
                                : isDark
                                  ? "0 4px 12px rgba(0,0,0,0.3)"
                                  : "0 4px 12px rgba(0,0,0,0.08)",
                        },
                        "&:active": {
                            transform: "translateY(0)",
                        },
                    }}
                >
                    {/* Unread indicator line */}
                    {activity.isRead === false && (
                        <Box
                            sx={{
                                position: "absolute",
                                left: 0,
                                top: "50%",
                                transform: "translateY(-50%)",
                                width: 3,
                                height: "60%",
                                borderRadius: "0 4px 4px 0",
                                background: isDark
                                    ? `linear-gradient(180deg, ${activityColor.dark} 0%, ${activityColor.dark}80 100%)`
                                    : `linear-gradient(180deg, ${activityColor.light} 0%, ${activityColor.light}80 100%)`,
                                boxShadow: isDark
                                    ? `0 0 8px ${activityColor.dark}60`
                                    : `0 0 8px ${activityColor.light}50`,
                            }}
                        />
                    )}

                    {/* Subtle gradient overlay for selected state */}
                    {isSelected && (
                        <Box
                            sx={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                width: "50%",
                                height: "100%",
                                background: isDark
                                    ? `radial-gradient(ellipse at top right, ${activityColor.dark}08 0%, transparent 70%)`
                                    : `radial-gradient(ellipse at top right, ${activityColor.light}06 0%, transparent 70%)`,
                                pointerEvents: "none",
                            }}
                        />
                    )}

                    <Stack
                        direction="column"
                        spacing={0.5}
                        sx={{ position: "relative", zIndex: 1 }}
                    >
                        <ActivityHeader
                            activity={activity}
                            chatTypeLookup={chatTypeLookup}
                            useCM={useCM}
                            isYou={isYou}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useTEM={useTEM}
                            useUISM={useUISM}
                        />

                        <ActivityContent
                            activity={activity}
                            groupedReactions={groupedReactions}
                            myself={myself}
                        />

                        {aggregatedCount > 1 && (
                            <Typography
                                level="body-xs"
                                sx={{
                                    ml: "44px",
                                    mt: 0.25,
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                    color: isDark
                                        ? `${activityColor.dark}cc`
                                        : `${activityColor.light}cc`,
                                }}
                            >
                                {fmt(t.chat.activity.aggregatedEarlier, {
                                    count: aggregatedCount - 1,
                                })}
                            </Typography>
                        )}
                    </Stack>
                </ListItemButton>
            </ListItem>
            <ListDivider
                sx={{
                    margin: 0,
                    opacity: isDark ? 0.04 : 0.06,
                }}
            />
        </React.Fragment>
    );
};
