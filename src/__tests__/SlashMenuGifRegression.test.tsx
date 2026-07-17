/**
 * Regression for the "Media Media Media" slash-menu bug: typing /gif
 * used to stack duplicate "Media" group labels because (a) the GIF
 * item was APPENDED after the last default group, minting a second
 * "Media" run whose label (keyed by group name) left stale DOM behind
 * on query narrowing, and (b) the editors mounted a custom "/"
 * controller WITHOUT slashMenu={false}, so BlockNote's built-in menu
 * rendered a second stacked copy on every "/".
 */
import { act } from "react";
import {
    BlockNoteSchema,
    defaultBlockSpecs,
    filterSuggestionItems,
    SuggestionMenu,
} from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import {
    getDefaultReactSlashMenuItems,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react";
import { render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { withGifSlashItem } from "../components/editors/GifToolbarButton";

// Mirrors the editable editors' wiring (custom "/" controller + built-in
// slash menu off).
const Harness = () => {
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;
    const schema = BlockNoteSchema.create({ blockSpecs: { ...remainingBlockSpecs } });
    const editor = useCreateBlockNote({ schema });
    (window as unknown as { __editor: unknown }).__editor = editor;
    return (
        <BlockNoteView
            editor={editor}
            emojiPicker={false}
            formattingToolbar={false}
            slashMenu={false}
        >
            <SuggestionMenuController
                triggerCharacter={"/"}
                getItems={async (query) =>
                    filterSuggestionItems(
                        withGifSlashItem(getDefaultReactSlashMenuItems(editor), vi.fn()),
                        query
                    )
                }
            />
        </BlockNoteView>
    );
};

beforeAll(() => {
    // jsdom rects lack toJSON, which the SuggestionMenu extension calls.
    const orig = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
        const rect = orig.call(this);
        (rect as unknown as { toJSON: () => unknown }).toJSON = () => rect;
        return rect;
    };
});

describe("withGifSlashItem", () => {
    it("splices the GIF item into the existing Media group, not the tail", () => {
        const items = [
            { title: "H1", group: "Headings", onItemClick: () => {} },
            { title: "Image", group: "Media", onItemClick: () => {} },
            { title: "File", group: "Media", onItemClick: () => {} },
            { title: "Emoji", group: "Others", onItemClick: () => {} },
        ];
        const out = withGifSlashItem(items, vi.fn());
        expect(out.map((i) => i.title)).toEqual(["H1", "Image", "File", "GIF", "Emoji"]);
    });

    it("appends when no Media group exists", () => {
        const items = [{ title: "H1", group: "Headings", onItemClick: () => {} }];
        const out = withGifSlashItem(items, vi.fn());
        expect(out.map((i) => i.title)).toEqual(["H1", "GIF"]);
    });
});

describe("slash menu DOM (typing /gif)", () => {
    it("renders exactly one menu, one Media label, one GIF item", async () => {
        render(<Harness />);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const editor = (window as unknown as { __editor: any }).__editor;
        await act(async () => {
            editor.focus();
            editor.getExtension(SuggestionMenu)?.openSuggestionMenu("/");
        });
        for (const ch of ["g", "i", "f"]) {
            await act(async () => {
                editor.insertInlineContent([{ type: "text", text: ch, styles: {} }]);
                await new Promise((r) => setTimeout(r, 30));
            });
        }

        await waitFor(() => {
            expect(
                [...document.querySelectorAll(".bn-suggestion-menu-item")].map(
                    (el) => el.textContent
                )
            ).toEqual(["GIFSearch GIPHY and insert a GIF"]);
        });
        expect(document.querySelectorAll(".bn-suggestion-menu").length).toBe(1);
        expect(
            [...document.querySelectorAll(".bn-suggestion-menu-label")].map((el) => el.textContent)
        ).toEqual(["Media"]);
    });
});

describe("built-in slash menu is disabled wherever a custom '/' controller exists", () => {
    it("every editor with a '/' SuggestionMenuController sets slashMenu={false}", async () => {
        const fs = await import("node:fs");
        const path = await import("node:path");
        const dir = path.resolve(__dirname, "../components/editors");
        const offenders: string[] = [];
        for (const file of fs.readdirSync(dir)) {
            if (!file.endsWith(".tsx")) continue;
            const text = fs.readFileSync(path.join(dir, file), "utf8");
            if (text.includes('triggerCharacter={"/"}') && !text.includes("slashMenu={false}")) {
                offenders.push(file);
            }
        }
        expect(offenders).toEqual([]);
    });
});
