import { PartialBlock } from "@blocknote/core";

// ---------------------------------------------------------------------------
// Body templates
// ---------------------------------------------------------------------------
//
// Each template is a small builder so we can vary headings/placeholders
// without copy-pasting BlockNote's verbose `props` blob. Placeholders use
// `italic + textColor: "gray"` instead of inline `code` styling, because
// inline-code stickiness used to bleed into whatever the user typed next.
//
// Lives in `utils/` so both `CreateTaskForm` (rich picker) and
// `createQuickTask` (title-only POST) can share the same default body
// without one having to import the other.

const HEADING_PROPS = {
    level: 3,
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const PARA_PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const heading = (text: string): PartialBlock => ({
    type: "heading",
    props: HEADING_PROPS,
    content: [{ text, type: "text", styles: {} }],
    children: [],
});

const placeholder = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: [{ text, type: "text", styles: { italic: true, textColor: "gray" } }],
    children: [],
});

const blank = (): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: [],
    children: [],
});

const bullet = (text: string): PartialBlock => ({
    type: "bulletListItem",
    props: PARA_PROPS,
    content: [{ text, type: "text", styles: { italic: true, textColor: "gray" } }],
    children: [],
});

const section = (title: string, ...body: PartialBlock[]): PartialBlock[] => [
    heading(title),
    ...body,
    blank(),
];

export type TaskTemplateId = "default" | "bug" | "spike" | "milestone";

export interface TaskTemplate {
    id: TaskTemplateId;
    label: string;
    description: string;
    labelKey: keyof (typeof import("../../../i18n/locales/en/tasks").tasks)["createForm"]["templates"];
    descriptionKey: keyof (typeof import("../../../i18n/locales/en/tasks").tasks)["createForm"]["templates"];
    blocks: PartialBlock[];
}

export const TASK_TEMPLATES: Record<TaskTemplateId, TaskTemplate> = {
    default: {
        id: "default",
        label: "Standard task",
        labelKey: "defaultLabel",
        description: "Goal, context, and acceptance criteria.",
        descriptionKey: "defaultDescription",
        blocks: [
            ...section("🧾 Summary", placeholder("One or two lines on what this task delivers.")),
            ...section(
                "🪜 Motivation",
                placeholder("Why does this matter? What problem are we solving?")
            ),
            ...section(
                "✅ Acceptance criteria",
                bullet("First condition that must be true when this is done."),
                bullet("Second condition…"),
                bullet("Third condition…")
            ),
            ...section("🎯 Notes & links", placeholder("Anything else worth pinning here.")),
        ],
    },
    bug: {
        id: "bug",
        label: "Bug report",
        labelKey: "bugLabel",
        description: "Repro steps, expected vs. actual behavior.",
        descriptionKey: "bugDescription",
        blocks: [
            ...section("🐞 Summary", placeholder("One-line description of the bug.")),
            ...section(
                "🔁 Steps to reproduce",
                bullet("Go to …"),
                bullet("Click on …"),
                bullet("Observe that …")
            ),
            ...section("🎯 Expected behavior", placeholder("What should happen?")),
            ...section(
                "💥 Actual behavior",
                placeholder("What actually happens? Include error messages, screenshots.")
            ),
            ...section(
                "🧪 Environment",
                placeholder("Browser, OS, app version, user, team, anything that narrows it down.")
            ),
        ],
    },
    spike: {
        id: "spike",
        label: "Research / spike",
        labelKey: "spikeLabel",
        description: "Question-led investigation with a timebox.",
        descriptionKey: "spikeDescription",
        blocks: [
            ...section("❓ Question", placeholder("What are we trying to learn or decide?")),
            ...section("💡 Hypothesis", placeholder("What do we currently believe is true?")),
            ...section(
                "🧭 Approach",
                bullet("Where to look first…"),
                bullet("Experiments / prototypes to try…"),
                bullet("People to talk to…")
            ),
            ...section("⏱ Timebox", placeholder("How long are we willing to spend on this?")),
            ...section(
                "📌 Findings",
                placeholder("Fill in as you learn — link out to docs, PRs, threads.")
            ),
            ...section(
                "🚧 Out of scope",
                placeholder("Explicitly things we are NOT answering here.")
            ),
        ],
    },
    milestone: {
        id: "milestone",
        label: "Milestone",
        labelKey: "milestoneLabel",
        description: "Goal, scope, success criteria, risks.",
        descriptionKey: "milestoneDescription",
        blocks: [
            ...section(
                "🎯 Goal",
                placeholder("What outcome does this milestone deliver, and for whom?")
            ),
            ...section(
                "✅ Success criteria",
                bullet("Measurable signal #1 that we hit the goal."),
                bullet("Measurable signal #2."),
                bullet("Measurable signal #3.")
            ),
            ...section(
                "📦 In scope",
                bullet("Workstream / feature 1"),
                bullet("Workstream / feature 2")
            ),
            ...section("🚫 Out of scope", bullet("Thing we are explicitly NOT doing.")),
            ...section(
                "⚠️ Risks & dependencies",
                placeholder("What could derail this? Who/what are we waiting on?")
            ),
        ],
    },
};

export const TASK_TEMPLATE_OPTIONS: TaskTemplate[] = [
    TASK_TEMPLATES.default,
    TASK_TEMPLATES.bug,
    TASK_TEMPLATES.spike,
    TASK_TEMPLATES.milestone,
];

// ---------------------------------------------------------------------------
// Custom (project-scoped) templates
// ---------------------------------------------------------------------------
//
// Members author these under a project (see the manage-templates modal +
// `/project/task-template/`). They appear in the create-form picker
// alongside — never replacing — the built-in `TASK_TEMPLATES` above, and
// are usable for both tasks and milestones.

export interface CustomTaskTemplate {
    id: number;
    templateName: string;
    body: PartialBlock[];
}

// The picker's `<Select>` value is a string. Built-ins use their
// `TaskTemplateId` verbatim; customs are namespaced so they can never
// collide with a built-in id (and so `applyTemplate` can branch on the
// prefix). Keep the encode/decode pair together.
const CUSTOM_TEMPLATE_PREFIX = "custom:";

export const customTemplateValue = (id: number): string => `${CUSTOM_TEMPLATE_PREFIX}${id}`;

export const parseCustomTemplateValue = (value: string): number | null => {
    if (!value.startsWith(CUSTOM_TEMPLATE_PREFIX)) return null;
    const raw = value.slice(CUSTOM_TEMPLATE_PREFIX.length);
    // Guard the empty suffix explicitly: `Number("")` is `0`, not `NaN`,
    // so without this `"custom:"` would decode to a bogus id 0. Ids are
    // integer PKs, so reject non-integers too.
    if (raw === "") return null;
    const id = Number(raw);
    return Number.isInteger(id) ? id : null;
};

// Initial body used by the rich CreateTaskForm and by the title-only
// createQuickTask service — both want a fresh task to land with the same
// scaffold so the body editor never feels empty on first open.
export const taskContentTemplate: PartialBlock[] = TASK_TEMPLATES.default.blocks;
