/**
 * MIP-1296: the dialog every preview opens in owns the geometry of its floating buttons
 * ("Move to page" and Close) and publishes it, so no header hosted inside carries a number
 * of its own, and the buttons are 44px targets on a touch screen.
 *
 * jsdom cannot lay anything out or evaluate `@media`, so the CSS the components emit is read
 * as text (`cssOf`); the measured result (no header control under another, at 390 and 1440,
 * light / dark / ar) is in the PR and in `design/evidence/MIP-1296.md`.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf, cssWithMediaOf } from "./utils/cssOf";

import { UrlLinkModal } from "../components/modals/UrlLinkModal";
import {
    MODAL_CHROME_CLEARANCE,
    MODAL_CHROME_EDGE,
    MODAL_CHROME_GAP,
    modalChromeEndPadding,
    modalChromeVarsSx,
} from "../components/ui/modal/modalChrome";
import type { ModalTarget } from "../utils/parseInternalUrl";

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../components/modals/views/ModalChatView", () => ({ ModalChatView: () => null }));
vi.mock("../components/modals/views/ModalMilestoneView", () => ({
    ModalMilestoneView: () => null,
}));
vi.mock("../components/modals/views/ModalNoteView", () => ({ ModalNoteView: () => null }));
vi.mock("../components/modals/views/ModalTaskView", () => ({ ModalTaskView: () => null }));
vi.mock("../components/modals/views/ModalTodoView", () => ({ ModalTodoView: () => null }));

afterEach(cleanup);

const TODO: ModalTarget = { kind: "todo", localDate: "2026-07-13" };

const renderModal = () => {
    render(
        <CssVarsProvider>
            <UrlLinkModal
                {...({
                    onClose: vi.fn(),
                    onOpenFullPage: vi.fn(),
                    accessToken: "token",
                    myself: { teamId: "t", userId: "u" },
                    setMyself: vi.fn(),
                    socket: null,
                    useTEM: {},
                    useUISM: {},
                    useCM: {},
                    useTM: {},
                    usePM: {},
                    useNM: {},
                    useSM: {},
                    useTG: {},
                } as unknown as React.ComponentProps<typeof UrlLinkModal>)}
                target={TODO}
            />
        </CssVarsProvider>
    );
    return {
        dialog: document.querySelector('[role="dialog"]') as HTMLElement,
        fullPage: screen.getByRole("button", { name: /open full page|move to page/i }),
        close: screen.getByRole("button", { name: /^close$/i }),
    };
};

describe("the chrome's published geometry", () => {
    it("is 36px with a mouse and 44px on a touch screen", () => {
        expect(modalChromeVarsSx["--modal-chrome-size"]).toBe("36px");
        expect(modalChromeVarsSx["@media (pointer: coarse)"]["--modal-chrome-size"]).toBe("44px");
    });

    it("the clearance covers edge + two buttons + the gap, at either size, with air to spare", () => {
        const formula = modalChromeVarsSx["--modal-chrome-clearance"];
        // calc(<edge>px + 2 * var(--modal-chrome-size) + <gap>px + <air>px)
        const [, edge, gap, air] = formula.match(
            /^calc\((\d+)px \+ 2 \* var\(--modal-chrome-size\) \+ (\d+)px \+ (\d+)px\)$/
        )!;
        expect(Number(edge)).toBe(MODAL_CHROME_EDGE);
        expect(Number(gap)).toBe(MODAL_CHROME_GAP);
        for (const size of [36, 44]) {
            const clearance = Number(edge) + 2 * size + Number(gap) + Number(air);
            const outerEdgeOfMoveToPage = MODAL_CHROME_EDGE + size + MODAL_CHROME_GAP + size;
            expect(clearance - outerEdgeOfMoveToPage).toBeGreaterThanOrEqual(16);
        }
    });

    it("a header asks for it with a fallback of nothing, so a page is unchanged", () => {
        expect(MODAL_CHROME_CLEARANCE).toBe("var(--modal-chrome-clearance, 0px)");
        expect(modalChromeEndPadding("24px").paddingInlineEnd.md).toBe(
            "max(24px, var(--modal-chrome-clearance, 0px))"
        );
        // A row whose own padding differs by breakpoint keeps each (a page is unchanged).
        expect(modalChromeEndPadding({ xs: "4px", md: "0px" }).paddingInlineEnd).toEqual({
            xs: "max(4px, var(--modal-chrome-clearance, 0px))",
            md: "max(0px, var(--modal-chrome-clearance, 0px))",
        });
        // Both breakpoints: a row that sets `px` per breakpoint must not out-rank it.
        expect(modalChromeEndPadding().paddingInlineEnd.xs).toBe(
            modalChromeEndPadding().paddingInlineEnd.md
        );
    });
});

describe("UrlLinkModal", () => {
    it("publishes the variables on the dialog", () => {
        const { dialog } = renderModal();
        const css = cssWithMediaOf(dialog);
        expect(css).toContain("--modal-chrome-size: 36px");
        expect(css).toContain("--modal-chrome-clearance");
        expect(css).toMatch(/@media \(pointer: coarse\) \{[^}]*--modal-chrome-size: 44px/);
    });

    it("sizes both buttons from the variable and lays Move to page out beside Close from it", () => {
        const { fullPage, close } = renderModal();
        for (const button of [fullPage, close]) {
            const css = cssOf(button);
            expect(css).toContain("--IconButton-size: var(--modal-chrome-size)");
            expect(css).toContain("min-width: var(--modal-chrome-size)");
            expect(css).toContain("min-height: var(--modal-chrome-size)");
        }
        // Edge + the Close button's width + the gap: it follows the size, so the two never
        // overlap or leave a hole when the touch buttons are bigger.
        expect(cssOf(fullPage)).toContain(
            `calc(${MODAL_CHROME_EDGE}px + var(--modal-chrome-size) + ${MODAL_CHROME_GAP}px)`
        );
        expect(cssOf(close)).toMatch(new RegExp(`right: ${MODAL_CHROME_EDGE}px`));
    });
});

describe("headers hosted in the dialog", () => {
    // Layout is not testable in jsdom: this pins the contract in the sources, and the
    // measured result is in the PR. Comments are stripped; they name the old behaviour.
    const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
    const code = (rel: string) =>
        readFileSync(join(SRC, rel), "utf8")
            .replace(/\/\*[\s\S]*?\*\//g, "")
            .replace(/^\s*\/\/.*$/gm, "");

    it("the chat and note headers keep their end corner free of the chrome", () => {
        for (const rel of [
            "features/chat/components/headers/MainChatPaneHeader.tsx",
            "features/chat/components/headers/ThreadChatPaneHeader.tsx",
            "features/notes/my-notes/components/MyNoteMain.tsx",
            "features/notes/task-notes/components/TaskNoteMain.tsx",
            "features/notes/chat-notes/components/ChatNoteMain.tsx",
        ]) {
            expect(code(rel), rel).toMatch(/\.\.\.modalChromeEndPadding\(/);
        }
    });

    it("the chat headers draw no second Close while hosted (the dialog has one)", () => {
        expect(code("features/chat/components/headers/MainChatPaneHeader.tsx")).toMatch(
            /\{!isModalHosted && \(\s*<AppTooltip size="sm" title=\{t\.chat\.headers\.close\}>/
        );
        expect(code("features/chat/components/headers/ThreadChatPaneHeader.tsx")).toMatch(
            /\{hostZIndex == null && \(\s*<AppTooltip size="sm" title=\{t\.chat\.headers\.close\}>/
        );
    });

    it("the task and milestone headers read the same published room (MIP-1169)", () => {
        for (const rel of [
            "features/tasks/components/contents/base/TaskTitleBlock.tsx",
            "features/tasks/components/contents/TaskPreview.tsx",
        ]) {
            expect(code(rel), rel).toContain("MODAL_CHROME_CLEARANCE");
            expect(code(rel), rel).toContain("components/ui/modal/modalChrome");
        }
    });
});
