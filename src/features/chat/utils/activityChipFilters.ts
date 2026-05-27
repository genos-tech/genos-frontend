import { ActivityMessageProps } from "../../../types/chat";

// Stable string id per filterable chip. Used as the multi-select
// payload (`Set<ChipId>`) so the value space is closed at the type
// level and the predicate map below stays exhaustive.
export type ChipId =
    | "project"
    | "dm"
    | "gm"
    | "pm"
    | "mdm"
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
    dm: (a) => a.chatType === 1,
    gm: (a) => a.chatType === 2,
    // chat_type 4 is dual-purpose: with a taskId it's a task comment,
    // without one it's an MDM message. Split on `taskId` so `mdm` and
    // `taskComment` partition the chatType-4 row space cleanly.
    mdm: (a) => a.chatType === 4 && !a.taskId,
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
    "mdm",
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
