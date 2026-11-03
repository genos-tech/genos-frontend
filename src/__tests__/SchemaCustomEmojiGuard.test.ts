/**
 * Schema drift guard for the `customEmoji` inline spec.
 *
 * There is no shared schema factory — every editor builds its own
 * `BlockNoteSchema.create({...})` (13 sites at the time of writing).
 * A body containing an inline type that a reader's schema doesn't
 * register makes BlockNote reject the WHOLE body ("node type not found
 * in schema", see bnChatPreview), so a single missed site breaks
 * rendering of any message/note that carries a custom emoji. This scan
 * fails CI the moment someone adds a new schema site without the spec.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = path.resolve(__dirname, "..");

const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "__tests__" || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...walk(full));
        } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
};

// The headless note schema (`applyNoteBodyToYjs` converts with it, MIP-949)
// is the one site that builds its specs from core's `createInlineContentSpec`
// instead of the editors' React factories, so it can't carry the literal
// `CreateCustomEmojiSpec()` line. It is held to the same rule in its own form.
const HEADLESS_SCHEMA = "components/editors/headlessNoteSchema.ts";

describe("customEmoji schema registration guard", () => {
    it("every BlockNoteSchema.create site registers the customEmoji spec", () => {
        const offenders: string[] = [];
        let sites = 0;
        for (const file of walk(SRC_ROOT)) {
            const text = fs.readFileSync(file, "utf8");
            if (!text.includes("BlockNoteSchema.create(")) continue;
            sites += 1;
            const relative = path.relative(SRC_ROOT, file);
            const registers =
                relative === HEADLESS_SCHEMA
                    ? text.includes(
                          "customEmoji: createInlineContentSpec(CUSTOM_EMOJI_SPEC_CONFIG"
                      )
                    : text.includes("customEmoji: CreateCustomEmojiSpec(),");
            if (!registers) offenders.push(relative);
        }
        // Sanity: the scan actually found the known editor surfaces.
        expect(sites).toBeGreaterThanOrEqual(13);
        expect(offenders).toEqual([]);
    });
});

describe("headless note schema registration guard", () => {
    // A chip or block added to the note editors but not to the headless
    // schema makes `applyNoteBodyToYjs` throw on any body that carries it
    // ("node type X not found in schema"), and nothing else would notice.
    const NOTE_EDITORS = [
        "components/editors/bnMyNoteEditor.tsx",
        "components/editors/bnTaskNoteEditor.tsx",
        "components/editors/bnChatNoteEditor.tsx",
    ];

    it.each(NOTE_EDITORS)("registers everything %s registers", (editorFile) => {
        const editor = fs.readFileSync(path.join(SRC_ROOT, editorFile), "utf8");
        const headless = fs.readFileSync(path.join(SRC_ROOT, HEADLESS_SCHEMA), "utf8");
        // `name: CreateXxxSpec(` for inline chips, `alert: Alert(` for the block.
        const chips = [...editor.matchAll(/^\s+(\w+): Create\w+Spec\(/gm)].map((m) => m[1]);
        expect(chips).toEqual(
            expect.arrayContaining([
                "mention",
                "mentionGroup",
                "customEmoji",
                "hashTask",
                "hashNote",
                "hashChat",
                "hashProject",
            ])
        );
        const missing = chips.filter(
            (name) => !headless.includes(`${name}: createInlineContentSpec(`)
        );
        if (
            /^\s+alert: Alert\(\)/m.test(editor) &&
            !headless.includes("alert: createBlockSpec(")
        ) {
            missing.push("alert");
        }
        expect(missing).toEqual([]);
    });
});
