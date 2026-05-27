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
    "pm",
    "project",
]);

// Maps each gating chip back to the `chatType` integer(s) used by
// `AllChatProps` / `ActivityMessageProps`. `dm` covers both 1:1 DMs
// (chatType 1) AND multi-user DMs (chatType 4, no taskId) because
// "MDM" is an internal term — to end users they're all "DM". `pm` and
// `project` both surface chat_type=3 chats — the broader `project`
// predicate covers task comments / task body / task note activities
// too, but the underlying chat list is the same set of PM rows.
export const GATING_CHIP_TO_CHATTYPES: Partial<Record<ChipId, readonly number[]>> = {
    dm: [1, 4],
    gm: [2],
    pm: [3],
    project: [3],
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
export const makeInstanceFilter =
    (selected: ReadonlySet<string>): ((a: ActivityMessageProps) => boolean) =>
    (a) => {
        if (selected.size === 0) return true;
        return selected.has(makeInstanceKey(a.chatType, a.chatId));
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
