import { ActivityMessageProps } from "../../../types/chat";

// Stable string id per filterable chip. Used as the multi-select
// payload (`Set<ChipId>`) so the value space is closed at the type
// level and the predicate map below stays exhaustive.
export type ChipId =
    | "project"
    | "dm"
    | "gm"
    | "pm"
    | "thread"
    | "reply"
    | "mention"
    | "reaction"
    | "task"
    | "taskComment"
    | "noteMy"
    | "noteTask"
    | "noteChat";

type Predicate = (a: ActivityMessageProps) => boolean;

// Predicates mirror the chip render conditions in `ActivityTypeChips`
// so the filter UI matches what the user sees on each activity row.
// Keep this in sync with that file when chip rules change. Keys are
// sorted alphabetically to satisfy `sort-keys`; semantic render order
// lives in `CHIP_ORDER` below.
export const CHIP_PREDICATES: Record<ChipId, Predicate> = {
    // "MDM" (multi-user DM) is an internal term — to end users it's just
    // a DM. The `dm` chip therefore covers chatType 1 AND chatType 4
    // without a taskId (chatType 4 with a taskId is a task comment,
    // partitioned off by the `taskComment` predicate below).
    dm: (a) => a.chatType === 1 || (a.chatType === 4 && !a.taskId),
    gm: (a) => a.chatType === 2,
    mention: (a) => a.activityType === 3,
    noteChat: (a) => a.chatType === 8,
    noteMy: (a) => a.chatType === 6,
    noteTask: (a) => a.chatType === 7,
    pm: (a) => a.chatType === 3,
    project: (a) =>
        !!a.projectName &&
        (a.chatType === 3 ||
            (a.chatType === 4 && !!a.taskId) ||
            a.chatType === 5 ||
            a.chatType === 7),
    reaction: (a) => a.activityType === 2,
    // Reply chip in `ActivityTypeChips` excludes chatType 4 (task
    // comment / MDM self-labels) and the chat_type 5-8 surfaces that
    // self-label as their own surface. Mirror that exclusion here.
    reply: (a) => a.activityType === 1 && a.chatType !== 4 && a.chatType !== 5 && a.chatType < 6,
    task: (a) => !!a.taskId,
    taskComment: (a) => a.chatType === 4 && !!a.taskId,
    thread: (a) => a.isThread === true,
};

// Primary single-select activity filter (the chip row's mutually-
// exclusive "All / Threads / Tasks / Mentions / Reactions" buttons).
// Keyed by the integer `currentActivityMessageType`:
//   0 = All, 1 = Thread, 2 = Task, 3 = Mention, 4 = Reaction.
// Extracted here (was inline in `ChatList`) so `selectVisibleActivityMessages`
// and the in-list filter share one definition. NOTE: type 2 ("Task") is
// `chatType > 2`, not `>= 2` — keep it that way.
export const ACTIVITY_PRIMARY_FILTERS: Record<number, Predicate> = {
    0: () => true,
    1: (a) => a.isThread === true,
    2: (a) => a.chatType > 2,
    3: (a) => a.activityType === 3,
    4: (a) => a.activityType === 2,
};

// AND-logic composer. An activity must satisfy EVERY selected chip
// predicate to pass. Empty selection short-circuits to true so
// "no chips active" reads as the unfiltered baseline.
//
// Some chip combinations form an empty set by construction
// (e.g. "DM" + "GM" — an activity has exactly one chatType, so it
// can never be both). That's intentional — the user has opted into
// the narrowest possible refinement; the empty-state UI handles it.
export const makeChipFilter =
    (selected: ReadonlySet<ChipId>): Predicate =>
    (a) => {
        if (selected.size === 0) return true;
        for (const id of selected) {
            if (!CHIP_PREDICATES[id](a)) return false;
        }
        return true;
    };

// Render order in the sidebar: surface (chat-type/note-type) chips
// first, then conversation-action chips, then task chips, then
// note-surface chips. Lines up roughly with how
// `ActivityTypeChips` groups them visually.
export const CHIP_ORDER: readonly ChipId[] = [
    "project",
    "dm",
    "gm",
    "pm",
    "thread",
    "reply",
    "mention",
    "reaction",
    "task",
    "taskComment",
    "noteMy",
    "noteTask",
    "noteChat",
];

// Shared module-level empty set so non-Activity `<ChatList>` instances
// can pass a stable reference and avoid re-running the per-render
// filter effect on identity-fresh sets.
export const EMPTY_CHIP_SET: ReadonlySet<ChipId> = new Set<ChipId>();

// ---------------------------------------------------------------------
// Instance-name filter (refines Custom chip selection)
// ---------------------------------------------------------------------
// Subset of chip ids that gate the "Filter by name" button next to the
// Custom dropdown. When any of these chips is active in
// `selectedChipIds`, the parent reveals the new button and the instance
// predicate engages; otherwise the predicate is pass-through and the
// instance state is auto-cleared upstream so it can't leak across
// gating-chip toggles.
export const INSTANCE_GATING_CHIPS: ReadonlySet<ChipId> = new Set<ChipId>([
    "dm",
    "gm",
    "noteTask",
    "pm",
    "project",
    "task",
    "taskComment",
]);

// Maps each gating chip back to the `chatType` integer(s) used by
// `AllChatProps` / `ActivityMessageProps`. `dm` covers both 1:1 DMs
// (chatType 1) AND multi-user DMs (chatType 4, no taskId) because
// "MDM" is an internal term — to end users they're all "DM". `pm` and
// `project` both surface chat_type=3 chats — the broader `project`
// predicate covers task comments / task body / task note activities
// too, but the underlying chat list is the same set of PM rows.
//
// `task`, `taskComment`, and `noteTask` also map to chatType 3 because
// every task lives inside a project, and projects are PM (chatType=3)
// chats. The "By name" menu shows the same PM list; the predicate
// below additionally matches activities by `projectId` so task
// comments (chatType=4), task body mentions (chatType=5), and task
// notes (chatType=7) — which have different chatTypes but share the
// project FK — get filtered correctly.
export const GATING_CHIP_TO_CHATTYPES: Partial<Record<ChipId, readonly number[]>> = {
    dm: [1, 4],
    gm: [2],
    noteTask: [3],
    pm: [3],
    project: [3],
    task: [3],
    taskComment: [3],
};

// Inverse lookup: when grouping the instance menu by chat-type, pick
// one canonical chip per chatType for the header label. "Project"
// reads more naturally than "PM" so it wins when chatType=3 is gated.
// chatType 4 (MDM) also maps to "dm" so MDM chats render under the
// DM header — same end-user-facing terminology.
export const CHATTYPE_HEADER_CHIP: Record<number, ChipId> = {
    1: "dm",
    2: "gm",
    3: "project",
    4: "dm",
};

// Stable string id used as the instance-filter payload:
// `${chatType}-${chatId}`. Works against both `ActivityMessageProps`
// and `AllChatProps`, so the same string keys the toggle UI and the
// predicate without an intermediate adapter type.
export const makeInstanceKey = (chatType: number, chatId: number): string =>
    `${chatType}-${chatId}`;

// OR-logic predicate — an activity matches if its (chatType, chatId)
// is in the selected set. Empty selection short-circuits to true so
// "button visible but nothing selected" reads as no narrowing.
//
// Project-scope fallback: a `3-${projectId}` key (produced by selecting
// a project in the "By name" menu) also matches activities where
// `projectId` equals that id, regardless of chatType. This lets one
// project selection cover the PM chat itself (chatType=3, chatId=
// projectId), its task comments (chatType=4, chatId=projectId), task
// body mentions (chatType=5, chatId=projectId), and task notes
// (chatType=7, chatId=noteId BUT projectId=projectId). Without the
// fallback, picking "Kraken" with the `task` chip would match nothing
// because task activities don't all share chatType=3.
export const makeInstanceFilter =
    (selected: ReadonlySet<string>): ((a: ActivityMessageProps) => boolean) =>
    (a) => {
        if (selected.size === 0) return true;
        if (selected.has(makeInstanceKey(a.chatType, a.chatId))) return true;
        if (a.projectId != null && selected.has(makeInstanceKey(3, a.projectId))) return true;
        return false;
    };

// True iff any gating chip is in `selected`. Drives both the
// conditional visibility of the "By name" button AND the upstream
// auto-clear effect that wipes the instance set when no gating chip
// remains.
export const hasGatingChip = (selected: ReadonlySet<ChipId>): boolean => {
    for (const id of selected) {
        if (INSTANCE_GATING_CHIPS.has(id)) return true;
    }
    return false;
};

export const EMPTY_INSTANCE_SET: ReadonlySet<string> = new Set<string>();

// ---------------------------------------------------------------------
// Mention-group filter (refines the "Mention" Custom chip)
// ---------------------------------------------------------------------
// Parallel to the instance filter above, but gated on the `mention` chip
// instead of the chat-type chips, and keyed by `MentionGroup.groupId`.
// Source data: `activity.mentionedViaGroups[myUserId]` — the set of
// groups that put the current user on this activity (direct @user
// mentions don't appear in the map).
//
// OR-logic predicate — an activity matches if any selected groupId is
// in the current user's group-origin list. Empty selection
// short-circuits to true.
export const makeMentionGroupFilter = (
    selected: ReadonlySet<number>,
    myUserId: string
): ((a: ActivityMessageProps) => boolean) => {
    return (a) => {
        if (selected.size === 0) return true;
        const myGroups = a.mentionedViaGroups?.[myUserId];
        if (!myGroups || myGroups.length === 0) return false;
        for (const gid of myGroups) {
            if (selected.has(gid)) return true;
        }
        return false;
    };
};

// Drives the conditional "By group" button visibility AND the
// upstream auto-clear effect that wipes the group set whenever the
// gating `mention` chip is deselected.
export const hasMentionGatingChip = (selected: ReadonlySet<ChipId>): boolean =>
    selected.has("mention");

export const EMPTY_GROUP_ID_SET: ReadonlySet<number> = new Set<number>();

// ---------------------------------------------------------------------
// Visible-set selector
// ---------------------------------------------------------------------
// Single source of truth for "which activities are currently visible in
// the sidebar feed". Composes, in order:
//   1. drops the synthetic thread-root placeholder (isThread + messageId 1),
//   2. the primary single-select filter (`ACTIVITY_PRIMARY_FILTERS`),
//   3. chip / instance-name / mention-group refinements (AND),
//   4. the "show only unread" toggle.
// Used both by `ChatList.useFilteredActivityMessages` (what the user sees)
// and by the "mark all filtered as read" action so the marked set is
// exactly the rendered set. Pure — safe to call inside an effect or a
// click handler.
export const selectVisibleActivityMessages = (
    activityMessages: ActivityMessageProps[],
    currentActivityMessageType: number,
    selectedChipIds: ReadonlySet<ChipId>,
    selectedInstanceIds: ReadonlySet<string>,
    selectedMentionGroupIds: ReadonlySet<number>,
    myUserId: string,
    showOnlyUnreadItems: boolean
): ActivityMessageProps[] => {
    const base = activityMessages.filter(
        (item) => !(item.isThread === true && item.messageId === 1)
    );
    const primaryFn = ACTIVITY_PRIMARY_FILTERS[currentActivityMessageType] ?? (() => true);
    const chipFn = makeChipFilter(selectedChipIds);
    const instanceFn = makeInstanceFilter(selectedInstanceIds);
    const mentionGroupFn = makeMentionGroupFilter(selectedMentionGroupIds, myUserId);
    const filtered = base.filter(
        (item) => primaryFn(item) && chipFn(item) && instanceFn(item) && mentionGroupFn(item)
    );
    return showOnlyUnreadItems ? filtered.filter((item) => item.isRead === false) : filtered;
};
