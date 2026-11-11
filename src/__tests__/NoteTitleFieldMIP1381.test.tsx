/**
 * MIP-1381. The title of a note used to be pinned to the top-left at a fixed 30% of the width
 * (50% on a phone), copied into three note editors: a long title was cut off at 400px of a
 * 1440px window with 500px of empty row beside it. It is now one component that does not size
 * itself, drawn by the editor shell in the same flex row as the controls.
 *
 * jsdom cannot lay anything out, so the sizes are pinned as the CSS the component emits, and the
 * wiring as the source; the measured widths in a real browser are in the PR.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cssOf } from "./utils/cssOf";

import { NoteTitleField } from "../features/notes/common/components/NoteTitleField";
import { en } from "../i18n/locales/en";

const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => mobile.value }));

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const code = (rel: string) =>
    readFileSync(join(SRC, rel), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

const mount = (over: Partial<Parameters<typeof NoteTitleField>[0]> = {}) => {
    const props = {
        value: "Weekly sync",
        inputRef: { current: null },
        onDraftChange: vi.fn(),
        onCommit: vi.fn(),
        ...over,
    };
    const view = render(
        <CssVarsProvider>
            <NoteTitleField {...props} />
        </CssVarsProvider>
    );
    return { ...view, props };
};
const LABEL = en.notes.editor.titlePlaceholder;
const input = () => screen.getByRole("textbox", { name: LABEL }) as HTMLInputElement;

beforeEach(() => {
    mobile.value = false;
});

describe("NoteTitleField", () => {
    it("is the note's title as an always-there field", () => {
        mount();
        expect(input().value).toBe("Weekly sync");
        expect(input().placeholder).toBe(LABEL);
    });

    it("hands the draft up as it is typed, and commits on Enter", () => {
        const { props } = mount();
        input().focus(); // Enter commits by blurring the field, as it does for a user who typed in it
        fireEvent.change(input(), { target: { value: "Weekly sync (moved)" } });
        expect(props.onDraftChange).toHaveBeenLastCalledWith("Weekly sync (moved)");
        fireEvent.keyDown(input(), { key: "Enter" });
        expect(props.onCommit).toHaveBeenCalledTimes(1);
    });

    it("hands the ref to the input (a new note focuses its title)", () => {
        const ref = { current: null as HTMLInputElement | null };
        mount({ inputRef: ref });
        expect(ref.current).toBe(input());
    });

    it("has no icon in front of it: the tab already carries the note icon, and it pushed the text off the body's edge", () => {
        const { container } = mount();
        expect(container.querySelector("svg")).toBeNull();
    });

    it("is 24px (h2) on a desktop, bigger than the body's first heading, and 20px (h3) on a phone", () => {
        const desktop = mount();
        expect(cssOf(input())).toMatch(/--type-h2-size|type-h2/);
        desktop.unmount();
        mobile.value = true;
        mount();
        expect(cssOf(input())).toMatch(/--type-h3-size|type-h3/);
    });

    it("takes the room it is given and does not size itself: no fixed share of the width", () => {
        const { container } = mount();
        const css = cssOf(container.firstElementChild as Element);
        expect(css).toMatch(/flex:\s*1/);
        expect(css).toMatch(/min-width:\s*0/);
        expect(css).not.toMatch(/(^|[^-])width:\s*(30|50)%/);
        expect(css).not.toMatch(/position:\s*absolute/);
    });
});

describe("the three note editors share it", () => {
    const EDITORS = [
        "features/notes/common/components/NoteEditor.tsx", // my and team notes
        "features/notes/chat-notes/components/ChatNoteEditor.tsx",
        "features/notes/task-notes/components/TaskNoteEditorPanel.tsx",
    ];

    it.each(EDITORS)("%s draws its title with NoteTitleField, through the shell's slot", (rel) => {
        const src = code(rel);
        expect(src).toContain("NoteTitleField");
        expect(src).toMatch(/(?<![\w-])titleSlot=\{\s*<NoteTitleField/);
    });

    it.each(EDITORS)("%s no longer carries its own pinned, fixed-width title", (rel) => {
        const src = code(rel);
        expect(src).not.toContain("InlineTitleEdit");
        expect(src).not.toMatch(/width:\s*isMobile\s*\?\s*"50%"\s*:\s*"30%"/);
        expect(src).not.toContain("NoteAltIcon");
    });
});

describe("the shell and the stylesheet agree on where the title starts", () => {
    it("GenosNoteEditor puts the title in the controls' row, which starts at the body's start", () => {
        const src = code("components/editors/genos/GenosNoteEditor.tsx");
        expect(src).toContain("{titleSlot}");
        expect(src).toMatch(/left:\s*"var\(--note-body-start, 50px\)"/);
        // One row: the title takes what the controls leave (so the sidebar opening narrows it).
        expect(src).toMatch(/right:\s*showComments \? COMMENTS_SIDEBAR_WIDTH \+ 12 : 52/);
        // The empty stretch of the row must not swallow clicks meant for the editor under it.
        expect(src).toMatch(/pointerEvents:\s*"none"/);
        expect(src).toMatch(/"& > \*":\s*\{\s*pointerEvents:\s*"auto"/);
    });

    it("the body's padding reads the same two variables, on a desktop and a phone", () => {
        const css = readFileSync(join(SRC, "App.css"), "utf8");
        expect(css).toMatch(
            /\.bn-note-body-box-light,\s*\.bn-note-body-box-dark\s*\{\s*--note-body-top:\s*64px;\s*--note-body-start:\s*50px;/
        );
        expect(css).toMatch(
            /padding:\s*var\(--note-body-top\) 50px 20px var\(--note-body-start\);/
        );
        // Phone: smaller values, and the existing rule reads them instead of its own literals.
        expect(css).toMatch(/--note-body-top:\s*56px;\s*--note-body-start:\s*44px;/);
        expect(css).toMatch(/padding-block:\s*var\(--note-body-top\) 20px;/);
        expect(css).toMatch(/padding-inline:\s*var\(--note-body-start\) 22px;/);
        expect(css).not.toMatch(
            /\.bn-note-body-box-(light|dark) \.bn-editor[^}]*padding[^}]*\b55px\b/
        );
    });
});
