import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

import shared from "../features/tasks/utils/builtinTaskTemplates.json";
import {
    getTaskContentTemplate,
    TASK_TEMPLATE_OPTIONS,
    TASK_TEMPLATES,
} from "../features/tasks/utils/taskTemplates";
import { en } from "../i18n/locales/en";
import golden from "./fixtures/taskTemplates.golden.json";

// MIP-1606. The four built-in body templates are written down ONCE, in
// `builtinTaskTemplates.json`, a vendored copy of genos-api's
// `origin/search_engine/agent/tools/builtin_task_templates.json` (the agent builds a task's body
// from the same headings). `taskTemplates.ts` builds its BlockNote blocks from it.
//
// `taskTemplates.golden.json` is what the hand-written constants produced BEFORE that move
// (ids, English labels, i18n keys and every block). It is deliberately not read from the shared
// file: a test that derived its expectation from the file would agree with whatever the file said.

// The hash of the PARSED content of the shared file (formatting does not count; `npm run format`
// re-indents JSON). The SAME value is pinned in genos-api's `test_builtin_task_templates.py`.
const PINNED_SHA256 = "7cbb3cae38bae98e63f653558ab4d9a43fa17da2f0163112ae1614913e55c62e";

describe("built-in task templates: what the form builds is what it built before", () => {
    it("offers the four templates in the picker's order", () => {
        expect(TASK_TEMPLATE_OPTIONS.map((t) => t.id)).toEqual([
            "default",
            "bug",
            "spike",
            "milestone",
        ]);
        expect(Object.keys(TASK_TEMPLATES)).toEqual(["default", "bug", "spike", "milestone"]);
    });

    it("keeps every template's id, label, i18n keys and blocks, to the last style prop", () => {
        const now = TASK_TEMPLATE_OPTIONS.map((t) => ({
            id: t.id,
            label: t.label,
            description: t.description,
            labelKey: t.labelKey,
            descriptionKey: t.descriptionKey,
            blocks: t.blocks,
        }));
        expect(now).toEqual(golden.options);
    });

    it("starts a quick-add task and a new form from the standard template, as before", () => {
        expect(getTaskContentTemplate("en")).toEqual(golden.options[0].blocks);
        expect(getTaskContentTemplate("en")).toBe(TASK_TEMPLATES.default.blocks);
    });

    it("keeps the English label the agent matches, equal to the English picker label", () => {
        for (const tpl of TASK_TEMPLATE_OPTIONS) {
            expect(tpl.label).toBe(en.tasks.createForm.templates[tpl.labelKey]);
        }
    });
});

describe("built-in task templates: the shared file", () => {
    it("has the hash the api pins too", () => {
        const hash = createHash("sha256").update(JSON.stringify(shared)).digest("hex");
        // If this fails: the file changed. genos-api keeps a copy of it
        // (origin/search_engine/agent/tools/builtin_task_templates.json): copy it THERE, and set the
        // new hash in BOTH repos' tests (here, and PINNED_SHA256 in
        // origin/tests/test_builtin_task_templates.py). Two copies that differ are a task form and an
        // agent that disagree about the sections of a template.
        expect(hash).toBe(PINNED_SHA256);
    });

    it("lists the same templates, in the same order, as the form offers", () => {
        expect(shared.templates.map((t) => t.id)).toEqual(TASK_TEMPLATE_OPTIONS.map((t) => t.id));
    });

    it("does not change when it is reindented, and does when a heading is edited or reordered", () => {
        const hashOf = (value: unknown) =>
            createHash("sha256").update(JSON.stringify(value)).digest("hex");
        const same = JSON.parse(JSON.stringify(shared, null, 2));
        expect(hashOf(same)).toBe(hashOf(shared));
        const edited = JSON.parse(JSON.stringify(shared));
        edited.templates[1].sections[0].heading += "!";
        expect(hashOf(edited)).not.toBe(hashOf(shared));
        const reordered = JSON.parse(JSON.stringify(shared));
        reordered.templates.reverse();
        expect(hashOf(reordered)).not.toBe(hashOf(shared));
    });
});
