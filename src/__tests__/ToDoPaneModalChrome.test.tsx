/**
 * MIP-1044 / MIP-1296: the to-do pane's header clears the modal's floating buttons.
 *
 * Inside UrlLinkModal the "open full page" and ✕ buttons float over the top end corner
 * (the dialog publishes how much room that takes: `--modal-chrome-clearance`, ui/modal/
 * modalChrome). The pane's header action row (tags, schedules, "Start today", "Start
 * tomorrow") sat on top of it and hid "Start tomorrow" (MIP-1044). On a phone the row does
 * not fit beside the title AND the clearance, so the actions wrap to their own line and
 * only the title line keeps the corner free (MIP-1296). On the page nothing changes.
 *
 * jsdom has no layout and ignores `@media`, so the CSS the pane emits is read as text; the
 * measured overlap check is in the PR (390 and 1440, light / dark / ar).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { cssOf, cssWithMediaOf } from "./utils/cssOf";

import { ToDoPane } from "../features/chat/ToDoPane";

let isMobileViewport = false;
vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => isMobileViewport }));
vi.mock("../features/chat/components/todo/TodoGroupCard", () => ({ TodoGroupCard: () => null }));
vi.mock("../features/chat/components/todo/titleMentions", () => ({
    TodoMentionsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../features/chat/components/todo/ModalManageTodoTags", () => ({
    ModalManageTodoTags: () => null,
}));
vi.mock("../features/chat/components/todo/ModalScheduledTodos", () => ({
    ModalScheduledTodos: () => null,
}));

afterEach(() => {
    cleanup();
    isMobileViewport = false;
});

const renderPane = (hostedInModal: boolean, mobile = false) => {
    isMobileViewport = mobile;
    const props = {
        useCM: {
            isSubChatVisible: false,
            showOnlyInCompleteTodos: false,
            setShowOnlyInCompleteTodos: vi.fn(),
        },
        useTG: {
            groups: [],
            categories: [],
            schedules: [],
            incompleteCount: 0,
            reminderByItemId: new Map(),
        },
        myself: {},
        useTEM: {},
        useUISM: {},
        setMyself: vi.fn(),
        socket: null,
        hostedInModal,
    };
    render(
        <CssVarsProvider>
            <ToDoPane {...(props as unknown as React.ComponentProps<typeof ToDoPane>)} />
        </CssVarsProvider>
    );
    return document.querySelector("[data-todo-header-row]") as HTMLElement;
};

const CLEARANCE = "var(--modal-chrome-clearance, 0px)";

describe("ToDoPane header row", () => {
    it("in a modal on a desktop, keeps the end corner free for the two floating buttons", () => {
        const css = cssOf(renderPane(true));
        expect(css).toContain("padding-inline-end");
        expect(css).toContain(CLEARANCE);
        // The row stays one line, as before.
        expect(css).not.toContain("flex-wrap: wrap");
    });

    it("in a modal on a phone, wraps the actions under the title, which keeps the corner", () => {
        const row = renderPane(true, true);
        const rowCss = cssOf(row);
        expect(rowCss).toContain("flex-wrap: wrap");
        // The clearance moves off the row (the actions line may use the full width) ...
        expect(rowCss).not.toContain(CLEARANCE);
        // ... and onto the title line, which is the only one the buttons float over.
        const titleCss = cssOf(row.children[0]);
        expect(titleCss).toContain(CLEARANCE);
        expect(titleCss).toContain("flex-basis: 100%");
    });

    it("in a modal, the actions are 44px targets on a touch screen", () => {
        const row = renderPane(true, true);
        const actions = cssWithMediaOf(row.children[1]);
        expect(actions).toMatch(/@media \(pointer: coarse\) \{[^}]*min-width: 44px/);
        expect(actions).toMatch(/@media \(pointer: coarse\) \{[^}]*min-height: 44px/);
    });

    it("on a desktop page, adds nothing: one line, no clearance", () => {
        const row = renderPane(false, false);
        const css = [row, row.children[0]].map(cssOf).join("\n");
        expect(css).not.toContain("modal-chrome");
        expect(css).not.toContain("flex-wrap: wrap");
        // The 44px floor is only ever under `pointer: coarse` (MIP-1319).
        const actions = cssOf(row.children[1]);
        expect(cssWithMediaOf(row.children[1])).toMatch(/@media \(pointer: coarse\)/);
        expect(actions).toContain("min-height: 44px");
    });

    it("on a phone page, the row may wrap but the title only gives up the line when it must (MIP-1319)", () => {
        const row = renderPane(false, true);
        expect(cssOf(row)).toContain("flex-wrap: wrap");
        const titleCss = cssOf(row.children[0]);
        // Not the dialog's full-width title line: it shares the row while it fits.
        expect(titleCss).not.toContain("flex-basis: 100%");
        expect(titleCss).not.toContain("modal-chrome");
        const actions = cssWithMediaOf(row.children[1]);
        expect(actions).toMatch(/@media \(pointer: coarse\) \{[^}]*min-height: 44px/);
    });
});
