import { PartialBlock } from "@blocknote/core";

import { resolveInitialLocale } from "../../../i18n/localeSource";
import type { Locale } from "../../../i18n/types";
import sharedTemplates from "./builtinTaskTemplates.json";
import { DEFAULT_TEMPLATE_ORDER, DEFAULT_TEMPLATE_TEXT } from "./defaultTemplateText";

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

// The sections, headings and prompts of the four templates are NOT written here: they live in
// `builtinTaskTemplates.json`, the one source (MIP-1606). It is a vendored copy of genos-api's
// `origin/search_engine/agent/tools/builtin_task_templates.json`, which the agent reads to make a
// task from a template by name; a test in each repo pins the same hash, so a copy that drifts
// fails CI. Headings and prompts are English only (they always were); the picker's label and
// description are translated through `labelKey` / `descriptionKey`, which stay here for typing.
interface SharedItem {
    kind: "placeholder" | "bullet";
    text: string;
}
interface SharedTemplate {
    id: string;
    label: string;
    sections: { heading: string; items: SharedItem[] }[];
}

const TEMPLATE_META: Record<
    TaskTemplateId,
    Pick<TaskTemplate, "description" | "labelKey" | "descriptionKey">
> = {
    default: {
        description: "Goal, context, and acceptance criteria.",
        labelKey: "defaultLabel",
        descriptionKey: "defaultDescription",
    },
    bug: {
        description: "Repro steps, expected vs. actual behavior.",
        labelKey: "bugLabel",
        descriptionKey: "bugDescription",
    },
    spike: {
        description: "Question-led investigation with a timebox.",
        labelKey: "spikeLabel",
        descriptionKey: "spikeDescription",
    },
    milestone: {
        description: "Goal, scope, success criteria, risks.",
        labelKey: "milestoneLabel",
        descriptionKey: "milestoneDescription",
    },
};

// The default template's section headings and lines in `locale` (MIP-1818). The JSON keeps the
// English; `DEFAULT_TEMPLATE_ORDER` says which word each position is. Only this template is
// translated: a line the order doesn't cover (a changed JSON) keeps its English.
const localizeDefault = (shared: SharedTemplate, locale: Locale): SharedTemplate => {
    const words = DEFAULT_TEMPLATE_TEXT[locale];
    return {
        ...shared,
        sections: shared.sections.map((sec, i) => {
            const keys = DEFAULT_TEMPLATE_ORDER[i] ?? [];
            return {
                heading: words[keys[0]] ?? sec.heading,
                items: sec.items.map((item, j) => ({
                    ...item,
                    text: words[keys[j + 1]] ?? item.text,
                })),
            };
        }),
    };
};

const buildTemplate = (shared: SharedTemplate, locale?: Locale): TaskTemplate => {
    if (locale && locale !== "en" && shared.id === "default") {
        shared = localizeDefault(shared, locale);
    }
    const id = shared.id as TaskTemplateId;
    const meta = TEMPLATE_META[id];
    if (!meta) throw new Error(`builtinTaskTemplates.json: unknown template id "${shared.id}"`);
    return {
        id,
        label: shared.label,
        ...meta,
        blocks: shared.sections.flatMap((s) =>
            section(
                s.heading,
                ...s.items.map((item) =>
                    item.kind === "bullet" ? bullet(item.text) : placeholder(item.text)
                )
            )
        ),
    };
};

// In the file's order, which is the picker's order.
export const TASK_TEMPLATE_OPTIONS: TaskTemplate[] = (
    sharedTemplates.templates as SharedTemplate[]
).map((s) => buildTemplate(s));

export const TASK_TEMPLATES = Object.fromEntries(
    TASK_TEMPLATE_OPTIONS.map((t) => [t.id, t])
) as Record<TaskTemplateId, TaskTemplate>;

/**
 * A built-in template's blocks in the app language (MIP-1818). The standard task template's
 * headings and hint lines follow the language the form is opened in, so what is SAVED reads in
 * it; the other three stay English for now. `locale` defaults to the current one.
 */
export const getTemplateBlocks = (id: TaskTemplateId, locale?: Locale): PartialBlock[] => {
    const loc = locale ?? resolveInitialLocale();
    if (id !== "default" || loc === "en") return TASK_TEMPLATES[id].blocks;
    const shared = (sharedTemplates.templates as SharedTemplate[]).find((t) => t.id === id)!;
    return buildTemplate(shared, loc).blocks;
};

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
// Built when asked, in the current language (MIP-1818), not once at load.
export const getTaskContentTemplate = (locale?: Locale): PartialBlock[] =>
    getTemplateBlocks("default", locale);

// ---------------------------------------------------------------------------
// Untouched template prompts (MIP-825)
// ---------------------------------------------------------------------------
//
// A template's prompts ("Why does this matter?", "First condition…") are real
// blocks, so an author who never fills a section saved them as the task's
// content, and a reader (a person or an agent) had to work out which lines
// were instructions. At submit the create form drops the ones left alone.
//
// A block is an untouched prompt only if BOTH hold: its text is exactly one of
// the built-in prompts AND it still carries the prompt styling (italic, gray).
// Typing into a prompt replaces its text, and a line the author wrote that
// happens to repeat a prompt doesn't have the styling, so neither is touched.
// Custom project templates aren't covered: their text isn't a known prompt.

type InlineLike = { type?: string; text?: string; styles?: Record<string, unknown> };
type BlockLike = {
    type?: string;
    content?: unknown;
    children?: unknown[];
};

const isPromptStyle = (styles: Record<string, unknown> | undefined): boolean =>
    styles?.italic === true && styles?.textColor === "gray";

// The one text run of a prompt block, or null if it isn't a single styled run.
const promptRun = (block: BlockLike): InlineLike | null => {
    if (block.type !== "paragraph" && block.type !== "bulletListItem") return null;
    if (block.children && block.children.length > 0) return null;
    const content = block.content;
    if (!Array.isArray(content) || content.length !== 1) return null;
    const run = content[0] as InlineLike;
    return run?.type === "text" && typeof run.text === "string" ? run : null;
};

// Every language's default-template lines count (MIP-1818): a form opened in ja, a draft saved
// in one language and reopened in another, all strip the same way.
const promptTexts = (blocks: PartialBlock[]): string[] =>
    (blocks as BlockLike[])
        .map(promptRun)
        .filter((run): run is InlineLike => run != null && isPromptStyle(run.styles))
        .map((run) => run.text as string);

const BUILT_IN_PROMPTS: ReadonlySet<string> = new Set([
    ...Object.values(TASK_TEMPLATES).flatMap((tpl) => promptTexts(tpl.blocks)),
    ...(Object.keys(DEFAULT_TEMPLATE_TEXT) as Locale[]).flatMap((loc) =>
        promptTexts(getTemplateBlocks("default", loc))
    ),
]);

const isUntouchedPrompt = (block: unknown): boolean => {
    const run = promptRun(block as BlockLike);
    return run != null && isPromptStyle(run.styles) && BUILT_IN_PROMPTS.has(run.text as string);
};

const isBlankParagraph = (block: unknown): boolean => {
    const b = block as BlockLike;
    return (
        b.type === "paragraph" &&
        (!b.children || b.children.length === 0) &&
        (!Array.isArray(b.content) ||
            b.content.every((r) => (r as InlineLike)?.type === "text" && !(r as InlineLike).text))
    );
};

/**
 * `blocks` without the template prompts the author left alone, and without a
 * heading (and the blank line after it) that is then left with nothing under
 * it. Anything before the first heading is kept as it is. A body that ends up
 * with no content at all becomes one empty paragraph, which the editor needs.
 */
export const stripUntouchedPrompts = <T>(blocks: T[]): T[] => {
    const out: T[] = [];
    let section: T[] = [];
    let sectionHeading: T | null = null;
    let sectionHasContent = false;

    const flush = () => {
        if (sectionHeading != null && !sectionHasContent) {
            // Nothing under it: drop the heading and its blank separators.
        } else {
            if (sectionHeading != null) out.push(sectionHeading);
            out.push(...section);
        }
        section = [];
        sectionHeading = null;
        sectionHasContent = false;
    };

    for (const block of blocks) {
        if ((block as BlockLike).type === "heading") {
            flush();
            sectionHeading = block;
            continue;
        }
        if (isUntouchedPrompt(block)) continue;
        if (sectionHeading == null) {
            out.push(block);
            continue;
        }
        section.push(block);
        if (!isBlankParagraph(block)) sectionHasContent = true;
    }
    flush();

    const hasContent = out.some((b) => !isBlankParagraph(b));
    return hasContent ? out : ([blank()] as unknown as T[]);
};
