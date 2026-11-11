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
    compactChipRowTouchSx,
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

describe("the To-Do pane header on a phone is compact", () => {
    const source = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "features/chat/ToDoPane.tsx"),
        "utf8"
    );
    it("pads the header and the title row tighter, only on a phone", () => {
        expect(source).toMatch(/pt: isMobile \? 1 : 2,/);
        expect(source).toMatch(/pb: isMobile \? 1 : 1\.5,/);
        expect(source).toMatch(/mb=\{isMobile \? 0\.5 : 1\.5\}/);
    });
    it("hands the tag row the compact mode on a phone", () => {
        expect(source).toMatch(/<TodoTagFilterBar[^>]*compact=\{isMobile\}/s);
    });
});

describe("the compact chip row (phone To-Do header)", () => {
    it("is shorter than the 44px row but keeps the same 44px hit band around the chip", () => {
        const full = chipRowTouchSx["@media (pointer: coarse)"];
        const compact = compactChipRowTouchSx["@media (pointer: coarse)"];
        expect(compact.minHeight).toBe(32);
        expect(compact.minHeight).toBeLessThan(full.minHeight);
        // Same reach above and below the 20px chip: 12 + 20 + 12 = 44.
        expect(compact["& .MuiChip-action::after"]).toEqual(full["& .MuiChip-action::after"]);
        // Room around the chip (6px) is never less than half the reach beyond it (6px), so
        // the band stops at the neighbouring row's chip instead of covering it.
        expect((compact.minHeight - 20) / 2).toBeGreaterThanOrEqual(
            -compact["& .MuiChip-action::after"].top - 6
        );
        expect(Object.keys(compactChipRowTouchSx)).toEqual(["@media (pointer: coarse)"]);
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
        expect(source).toContain("isMobile ? compactChipRowTouchSx : chipRowTouchSx");
        expect(source).toContain('touchTargetSx("& .MuiIconButton-root, & .MuiButton-root")');
        // The wrap treatment is no longer gated on the dialog.
        expect(source).toMatch(/isMobile\s*\?\s*\{ flexWrap: "wrap", rowGap: 1 \}/);
    });
});

describe("the To-Do tag filter chips, compact (phone header)", () => {
    const view = (compact: boolean) => {
        render(
            <CssVarsProvider>
                <TodoTagFilterBar
                    categories={[{ categoryId: 1, color: "#f00", name: "Work" } as never]}
                    compact={compact}
                    isDark={false}
                    selected={new Set()}
                    onClear={vi.fn()}
                    onToggle={vi.fn()}
                />
            </CssVarsProvider>
        );
        return cssWithMediaOf(screen.getByRole("button", { name: "Work" }));
    };
    it("is 32px tall with an invisible 44px hit area instead of 44px of layout", () => {
        const css = view(true);
        expect(css).toMatch(/@media \(pointer: coarse\)[^{]*\{[^}]*min-height: 32px/);
        expect(css).not.toMatch(/min-height: 44px/);
        expect(css).toMatch(/::after[^{]*\{[^}]*height: 44px/);
    });
    it("closes the gaps around the row, and only in compact mode", () => {
        view(true);
        const compactGroup = cssWithMediaOf(screen.getByRole("group"));
        expect(compactGroup).toMatch(/margin-top: 2px/);
        expect(compactGroup).toMatch(/gap: 4px/);
        cleanup();
        view(false);
        const fullGroup = cssWithMediaOf(screen.getByRole("group"));
        expect(fullGroup).toMatch(/margin-top: 8px/);
        expect(fullGroup).toMatch(/gap: 6px/);
    });
    it("stays 44px tall when not compact (the dialog on a desktop)", () => {
        const css = view(false);
        expect(css).toMatch(/min-height: 44px/);
        expect(css).not.toMatch(/::after/);
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
