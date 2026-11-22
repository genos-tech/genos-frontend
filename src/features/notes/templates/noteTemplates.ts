import type { PartialBlock } from "@blocknote/core";

import type { Messages } from "../../../i18n/types";

// MIP-1697. Built-in note templates, written as BlockNote blocks and handed to the create-note
// handlers as `opts.body`. Hints are italic gray (same convention as the task templates), so
// typing over them never inherits odd styling. The decision record mirrors the one in
// genos-docs `skills/genos-workflow/references/templates.md`.

export const NOTE_TEMPLATE_IDS = ["meeting", "decision", "brief"] as const;
export type NoteTemplateId = (typeof NOTE_TEMPLATE_IDS)[number];
export type NoteTemplateCopy = Messages["notes"]["noteTemplates"];

const PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const heading = (text: string): PartialBlock => ({
    type: "heading",
    props: { ...PROPS, level: 3 },
    content: [{ type: "text", text, styles: {} }],
    children: [],
});

const hint = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PROPS,
    content: [{ type: "text", text, styles: { italic: true, textColor: "gray" } }],
    children: [],
});

const plain = (text: string): PartialBlock => ({
    type: "paragraph",
    props: PROPS,
    content: [{ type: "text", text, styles: {} }],
    children: [],
});

const check = (): PartialBlock => ({
    type: "checkListItem",
    props: { ...PROPS, checked: false },
    content: [],
    children: [],
});

const blank = (): PartialBlock => ({
    type: "paragraph",
    props: PROPS,
    content: [],
    children: [],
});

const section = (title: string, hintText: string, ...extra: PartialBlock[]): PartialBlock[] => [
    heading(title),
    hint(hintText),
    ...extra,
];

/** Local calendar date as YYYY-MM-DD (the user's day, not UTC). */
export const isoDay = (d: Date): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function buildNoteTemplate(
    id: NoteTemplateId,
    copy: NoteTemplateCopy,
    today: Date = new Date()
): { title: string; blocks: PartialBlock[] } {
    const date = isoDay(today);
    const fill = (s: string) => s.replace("{date}", date);
    if (id === "meeting") {
        const c = copy.meeting;
        return {
            title: fill(c.title),
            blocks: [
                ...section(c.attendees, c.attendeesHint),
                ...section(c.agenda, c.agendaHint),
                ...section(c.notes, c.notesHint),
                ...section(c.decisions, c.decisionsHint),
                ...section(c.actions, c.actionsHint, check()),
                blank(),
            ],
        };
    }
    if (id === "decision") {
        const c = copy.decision;
        return {
            title: fill(c.title),
            blocks: [
                plain(fill(c.meta)),
                ...section(c.decision, c.decisionHint),
                ...section(c.why, c.whyHint),
                ...section(c.context, c.contextHint),
                ...section(c.options, c.optionsHint),
                ...section(c.consequences, c.consequencesHint),
                ...section(c.links, c.linksHint),
                blank(),
            ],
        };
    }
    const c = copy.brief;
    return {
        title: fill(c.title),
        blocks: [
            ...section(c.goal, c.goalHint),
            ...section(c.background, c.backgroundHint),
            ...section(c.scope, c.scopeHint),
            ...section(c.success, c.successHint, check()),
            ...section(c.milestones, c.milestonesHint),
            ...section(c.risks, c.risksHint),
            ...section(c.people, c.peopleHint),
            blank(),
        ],
    };
}
