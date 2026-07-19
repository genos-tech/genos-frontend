import { describe, expect, it } from "vitest";

import {
    customTemplateValue,
    parseCustomTemplateValue,
    TASK_TEMPLATE_OPTIONS,
} from "../features/tasks/utils/taskTemplates";

// The create-form picker mixes built-in template ids ("default", "bug", …)
// and custom project templates in one `<Select>`; `applyTemplate` branches
// on whether the value decodes to a custom id. These helpers are that
// branch's decision, so they're the unit worth pinning.
describe("custom template picker values", () => {
    it("round-trips a numeric id through encode/decode", () => {
        expect(parseCustomTemplateValue(customTemplateValue(42))).toBe(42);
        expect(parseCustomTemplateValue(customTemplateValue(1))).toBe(1);
    });

    it("returns null for every built-in template id (so they take the built-in branch)", () => {
        for (const tpl of TASK_TEMPLATE_OPTIONS) {
            expect(parseCustomTemplateValue(tpl.id)).toBeNull();
        }
    });

    it("returns null for the manage-action sentinel and other non-custom values", () => {
        expect(parseCustomTemplateValue("__manage_templates__")).toBeNull();
        expect(parseCustomTemplateValue("")).toBeNull();
        expect(parseCustomTemplateValue("customish")).toBeNull();
    });

    it("returns null when the custom suffix is not a finite number", () => {
        expect(parseCustomTemplateValue("custom:")).toBeNull();
        expect(parseCustomTemplateValue("custom:abc")).toBeNull();
    });

    it("namespaces custom values so they can never equal a built-in id", () => {
        const builtinIds = new Set(TASK_TEMPLATE_OPTIONS.map((t) => t.id));
        expect(builtinIds.has(customTemplateValue(1))).toBe(false);
    });
});
