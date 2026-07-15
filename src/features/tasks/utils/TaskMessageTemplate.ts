import { getMessages } from "../../../i18n";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { Milestone } from "../sprint-milestone/types";
import { effortLevels, priorities, statuses } from "./taskMeta";

// BlockNote ships a fixed palette for `textColor` (see
// `@blocknote/core/src/editor/defaultColors.ts`). Anything else gets
// passed through as a CSS color string and breaks the dark/light
// theming, so we map taskMeta's hex codes to the closest named slot
// here. Keep this table in sync if `taskMeta.ts` ever picks new colors.
type BlockNoteTextColor =
    | "default"
    | "gray"
    | "brown"
    | "red"
    | "orange"
    | "yellow"
    | "green"
    | "blue"
    | "purple"
    | "pink";

// Tuple list (rather than an object literal) so the entries can stay
// grouped by what they represent (statuses first, then the
// priority/effort palette). Object literals would drag every key
// through the alphabetical `sort-keys` rule which produces a less
// readable order for arbitrary hex strings.
const HEX_TO_BLOCKNOTE_PALETTE: Record<string, BlockNoteTextColor> = Object.fromEntries([
    ["#0044c2", "blue"], // status Open
    ["#ff8c00", "orange"], // status WIP
    ["#b900ff", "purple"], // status Pending
    ["#1dc200", "green"], // status Closed
    ["#ff2323", "red"], // status Deleted
    ["#9CA3AF", "gray"], // Minimal (priority/effort)
    ["#34D399", "green"], // Low (priority/effort)
    ["#3B82F6", "blue"], // Normal (priority) / Moderate (effort)
    ["#F59E0B", "orange"], // High (priority/effort)
    ["#EF4444", "red"], // Critical (priority) / Extensive (effort)
] as const);

const paletteFromHex = (hex: string | null | undefined): BlockNoteTextColor => {
    if (!hex) return "default";
    return HEX_TO_BLOCKNOTE_PALETTE[hex] ?? "default";
};

// Shape every coloured-value chip rendered inside a chat block ends up
// as. `type: "text"` is required by BlockNote's inline-content schema —
// the styling is what carries the colour.
type ColoredValueChip = {
    styles: { bold: true; textColor: BlockNoteTextColor };
    text: string;
    type: "text";
};

const NEUTRAL_FALLBACK_CHIP: ColoredValueChip = {
    styles: { bold: true, textColor: "gray" },
    text: "—",
    type: "text",
};

// Build a `{label: chip}` lookup straight from a taskMeta array so the
// chat colours always match the rest of the task UI. Whatever label
// the backend sends is the same key we look up — no second translation
// table to drift.
const buildChipLookup = <T extends { color: string | null }>(
    items: readonly T[],
    labelOf: (item: T) => string | null
): Record<string, ColoredValueChip> => {
    const out: Record<string, ColoredValueChip> = {};
    for (const item of items) {
        const label = labelOf(item);
        if (!label) continue;
        out[label] = {
            styles: { bold: true, textColor: paletteFromHex(item.color) },
            text: label,
            type: "text",
        };
    }
    return out;
};

const STATUS_CHIPS = buildChipLookup(statuses, (s) => s.status);
const PRIORITY_CHIPS = buildChipLookup(priorities, (p) => p.priority);
const EFFORT_CHIPS = buildChipLookup(effortLevels, (e) => e.level);

const getStatusChip = (key: string | null | undefined): ColoredValueChip =>
    (key && STATUS_CHIPS[key]) || NEUTRAL_FALLBACK_CHIP;

const getPriorityChip = (key: string | null | undefined): ColoredValueChip =>
    (key && PRIORITY_CHIPS[key]) || NEUTRAL_FALLBACK_CHIP;

const getEffortChip = (key: string | null | undefined): ColoredValueChip =>
    (key && EFFORT_CHIPS[key]) || NEUTRAL_FALLBACK_CHIP;

// `props` shared by every paragraph/heading we emit. Pulled out so the
// templates below stay focused on content.
const DEFAULT_BLOCK_PROPS = {
    backgroundColor: "default",
    textAlignment: "left",
    textColor: "default",
} as const;

const HEADING_BLOCK_PROPS = {
    backgroundColor: "default",
    level: 3,
    textAlignment: "left",
    textColor: "default",
} as const;

// Spacer paragraph appended to every multi-block message so the chat
// renderer leaves a blank line between this message and the next one.
const blankParagraph = () => ({
    children: [],
    content: [],
    props: DEFAULT_BLOCK_PROPS,
    type: "paragraph",
});

// Bold "Label:" prefix used on every meta line. Puts the visual weight
// on the label so the value chip pops next to it.
const labelText = (text: string) => ({
    styles: { bold: true } as const,
    text,
    type: "text",
});

const plainText = (text: string) => ({
    styles: {},
    text,
    type: "text",
});

const mentionNode = (myself: UserProps, user: UserProps) => ({
    props: {
        avatarImgPath: [""],
        customStatus: "N/A",
        teamId: myself.teamId,
        teamName: "N/A",
        userEmail: user.userEmail,
        userId: user.userId,
        userName: user.userName,
    },
    type: "mention",
});

export const taskMessageTemplate = (myself: UserProps, task: TaskProps) => {
    const m = getMessages().tasks.messageTemplate;
    return [
        {
            children: [],
            content: [plainText(`🧾 ${task.title}`)],
            props: HEADING_BLOCK_PROPS,
            type: "heading",
        },
        {
            children: [],
            content: [labelText(m.statusLabel), getStatusChip(task.status?.status)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [labelText(m.priorityLabel), getPriorityChip(task.priority?.priority)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [labelText(m.effortLabel), getEffortChip(task.effortLevel?.level)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [
                labelText(m.assigneeLabel),
                // `task.assignee` is nullable — a task can legitimately
                // be unassigned. Fall back to italic "Unassigned" text
                // instead of crashing inside `mentionNode`.
                task.assignee ? mentionNode(myself, task.assignee) : plainText(m.unassigned),
            ],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [labelText(m.reporterLabel), mentionNode(myself, task.reporter)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [labelText(m.dueLabel), plainText(`📅 ${task.dueDate || "—"}`)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        blankParagraph(),
    ];
};

// Milestone-flavoured equivalents of the task templates above. The
// PM chat needs a similar "something was created" message bubble for
// new milestones (see CreateTaskForm.handleCreateMilestone), but with
// milestone-specific lines: a flag-prefixed title, a sprint linkage
// row, and a multi-mention assignee row (milestones can have N
// assignees while tasks have exactly one). Effort level is omitted
// on purpose because the milestone form doesn't expose it.
export const milestoneMessageTemplate = (
    myself: UserProps,
    milestone: Milestone,
    sprintName: string,
    reporter: UserProps,
    assignees: UserProps[]
) => {
    const m = getMessages().tasks.messageTemplate;
    const blocks: Array<Record<string, unknown>> = [
        {
            children: [],
            content: [plainText(`🚩 ${milestone.title}`)],
            props: HEADING_BLOCK_PROPS,
            type: "heading",
        },
        {
            children: [],
            content: [
                labelText(m.sprintLabel),
                {
                    styles: { bold: true, textColor: "blue" } as const,
                    text: sprintName || "—",
                    type: "text",
                },
            ],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            // Milestones default to "Open" at create time; the helper
            // also handles legacy/empty values gracefully.
            content: [labelText(m.statusLabel), getStatusChip(milestone.status || "Open")],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [labelText(m.priorityLabel), getPriorityChip(milestone.priority)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
        {
            children: [],
            content: [labelText(m.reporterLabel), mentionNode(myself, reporter)],
            props: DEFAULT_BLOCK_PROPS,
            type: "paragraph",
        },
    ];

    // Multi-assignee mention row. Each assignee gets its own mention
    // node interleaved with a comma + space text node so the chat
    // renderer keeps mention click-through (you can't put commas
    // inside a mention node itself).
    const assigneeContent: Array<Record<string, unknown>> = [labelText(m.assigneesLabel)];
    if (assignees.length === 0) {
        assigneeContent.push({
            styles: { italic: true, textColor: "gray" },
            text: m.unassigned,
            type: "text",
        });
    } else {
        assignees.forEach((a, idx) => {
            if (idx > 0) {
                assigneeContent.push(plainText(", "));
            }
            assigneeContent.push(mentionNode(myself, a));
        });
    }
    blocks.push({
        children: [],
        content: assigneeContent,
        props: DEFAULT_BLOCK_PROPS,
        type: "paragraph",
    });

    blocks.push({
        children: [],
        content: [labelText(m.dueLabel), plainText(`📅 ${milestone.dueDate ?? "—"}`)],
        props: DEFAULT_BLOCK_PROPS,
        type: "paragraph",
    });

    blocks.push(blankParagraph());

    return blocks;
};
