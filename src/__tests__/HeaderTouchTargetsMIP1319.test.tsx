/**
 * MIP-1319: every icon button in a header, and every filter chip row, is a 44px tap target on a
 * touch screen, from one rule (`ui/touchTargets`), and nothing changes with a mouse.
 *
 * jsdom evaluates no `@media`, so the CSS the components emit is read as text (`cssWithMediaOf`
 * keeps the condition). The measured sizes at 390 (every header, before / after) are in the PR
 * and in `design/evidence/MIP-1319.md`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssWithMediaOf } from "./utils/cssOf";

import { PageHeader } from "../components/ui/page/PageHeader";
import { pageHeaderFrameSx } from "../components/ui/page/pageHeaderFrame";
import {
    chipRowTouchSx,
    headerTouchTargetsSx,
    TOUCH_TARGET,
    touchTargetSx,
} from "../components/ui/touchTargets";
import { TodoTagFilterBar } from "../features/chat/components/todo/TodoTagFilterBar";

vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "t" }) }));

afterEach(cleanup);

const COARSE = /@media \(pointer: coarse\)/;

describe("the shared rules", () => {
    it("a header icon button is 44px (min size, only on a coarse pointer)", () => {
        expect(TOUCH_TARGET).toBe(44);
        expect(headerTouchTargetsSx["@media (pointer: coarse)"]["& .MuiIconButton-root"]).toEqual({
            minHeight: 44,
            minWidth: 44,
        });
        // Nothing outside the media query: a mouse sees no change.
        expect(Object.keys(headerTouchTargetsSx)).toEqual(["@media (pointer: coarse)"]);
    });

    it("the page header frame carries it, so every header wearing the frame gets it", () => {
        expect(pageHeaderFrameSx["@media (pointer: coarse)"]).toEqual(
            headerTouchTargetsSx["@media (pointer: coarse)"]
        );
    });

    it("touchTargetSx names its selector and nothing else", () => {
        expect(touchTargetSx(".x")).toEqual({
            "@media (pointer: coarse)": { ".x": { minHeight: 44, minWidth: 44 } },
        });
    });

    it("a chip row is a 44px band on a coarse pointer and the chip is not resized", () => {
        const coarse = chipRowTouchSx["@media (pointer: coarse)"];
        expect(coarse.minHeight).toBe(44);
        // The reach above and below a 20px chip, so the band is 44px.
        expect(coarse["& .MuiChip-action::after"].top).toBe(-12);
        expect(coarse["& .MuiChip-action::after"].bottom).toBe(-12);
        expect(JSON.stringify(coarse)).not.toMatch(/"height"/);
    });
});

describe("the headers that wear the frame", () => {
    it("PageHeader emits the 44px rule only under a coarse pointer", () => {
        render(
            <CssVarsProvider>
                <PageHeader actions={<button>act</button>} title="Inbox" />
            </CssVarsProvider>
        );
        const css = cssWithMediaOf(document.querySelector("header")!);
        expect(css).toMatch(COARSE);
        expect(css).toMatch(/\.MuiIconButton-root[^{]*\{[^}]*min-height: 44px/);
        expect(css).toMatch(/\.MuiIconButton-root[^{]*\{[^}]*min-width: 44px/);
    });
});

describe("the headers that do not wear the frame use the same rule", () => {
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
    it.each([
        "features/notes/common/components/NoteHeaderActions.tsx",
        "features/tasks/components/contents/base/TaskTitleBlock.tsx",
        "features/tasks/components/contents/TaskPreview.tsx",
    ])("%s spreads headerTouchTargetsSx", (rel) => {
        const source = readFileSync(join(SRC, rel), "utf8");
        expect(source).toMatch(/\.\.\.headerTouchTargetsSx/);
        expect(source).toContain("components/ui/touchTargets");
    });

    it("the To-Do pane: actions 44px on the page too, filter chips banded, title row wraps on a phone", () => {
        const source = readFileSync(join(SRC, "features/chat/ToDoPane.tsx"), "utf8");
        expect(source).toContain("sx={chipRowTouchSx}");
        expect(source).toContain('touchTargetSx("& .MuiIconButton-root, & .MuiButton-root")');
        // The wrap treatment is no longer gated on the dialog.
        expect(source).toMatch(/isMobile\s*\?\s*\{ flexWrap: "wrap", rowGap: 1 \}/);
    });
});

describe("the To-Do tag filter chips", () => {
    it("are 44px tall and wide on a coarse pointer; the ring stays on the chip", () => {
        render(
            <CssVarsProvider>
                <TodoTagFilterBar
                    categories={[{ categoryId: 1, color: "#f00", name: "Work" } as never]}
                    isDark={false}
                    selected={new Set([1])}
                    onClear={vi.fn()}
                    onToggle={vi.fn()}
                />
            </CssVarsProvider>
        );
        const button = screen.getByRole("button", { name: "Work" });
        const css = cssWithMediaOf(button);
        expect(css).toMatch(/@media \(pointer: coarse\)[^{]*\{[^}]*min-height: 44px/);
        expect(css).toMatch(/@media \(pointer: coarse\)[^{]*\{[^}]*min-width: 44px/);
        const chip = button.querySelector("[data-tag-chip]") as HTMLElement;
        expect(cssWithMediaOf(chip)).toMatch(/box-shadow: 0 0 0 2px/);
        expect(cssWithMediaOf(button)).not.toMatch(/box-shadow: 0 0 0 2px/);
    });
});
