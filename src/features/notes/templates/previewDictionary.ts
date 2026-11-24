import { en } from "@blocknote/core/locales";

/**
 * BlockNote paints a placeholder ("List", "Heading", ...) on EVERY empty block of a type, even
 * when the editor is read-only, and the strings are English. A template with an empty checklist
 * row showed an English "List" inside the Japanese picker. A read-only preview needs no editing
 * hint, so every placeholder is blank.
 */
export const previewDictionary: typeof en = {
    ...en,
    placeholders: Object.fromEntries(
        Object.keys(en.placeholders).map((key) => [key, ""])
    ) as typeof en.placeholders,
};
