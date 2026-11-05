/**
 * MIP-1047: the layer the to-do modal sits at reaches the pane's dialogs.
 *
 *   UrlLinkModal (effective layer) → ModalTodoView (hostZIndex) → ToDoPane
 *   (provider) → each dialog.
 * The dialogs themselves are in TodoHostLayer.test.tsx; this pins the three
 * hand-offs between the pieces.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToDoPane } from "../features/chat/ToDoPane";
import { en } from "../i18n/locales/en";

const seen = vi.hoisted(() => ({
    pane: null as null | Record<string, unknown>,
    view: null as null | Record<string, unknown>,
}));

vi.mock("../hooks/common/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("../hooks/common/UrlLinkModalContext", () => ({
    useUrlLinkModal: () => ({ openModalByHref: vi.fn() }),
}));
vi.mock("../features/chat/components/todo/TodoGroupCard", () => ({ TodoGroupCard: () => null }));
vi.mock("../features/chat/components/todo/ModalManageTodoTags", () => ({
    ModalManageTodoTags: () => null,
}));

beforeEach(() => {
    seen.pane = null;
    seen.view = null;
});
afterEach(cleanup);

describe("UrlLinkModal → ModalTodoView", () => {
    it("hands the todo view the layer the modal sits at (its default 10020, or the opener's)", async () => {
        // The real view is lazy and heavy; this reads the call site.
        const fs = await import("node:fs");
        const path = await import("node:path");
        const src = fs.readFileSync(
            path.resolve(__dirname, "../components/modals/UrlLinkModal.tsx"),
            "utf8"
        );
        expect(src).toMatch(/<ModalTodoView[\s\S]*?hostZIndex=\{effectiveZIndex\}/);
        expect(src).toMatch(/const effectiveZIndex = zIndex \?\? 10020/);
    });
});

describe("ModalTodoView → ToDoPane", () => {
    it("passes hostZIndex on, and marks the pane as modal-hosted", async () => {
        vi.doMock("../features/chat/ToDoPane", () => ({
            ToDoPane: (p: Record<string, unknown>) => {
                seen.pane = p;
                return <div />;
            },
        }));
        const { ModalTodoView: View } = await import("../components/modals/views/ModalTodoView");
        render(
            <CssVarsProvider>
                <View
                    {...({
                        target: { kind: "todo" },
                        onClose: vi.fn(),
                        accessToken: "t",
                        myself: { userId: "u", teamId: "t" },
                        setMyself: vi.fn(),
                        socket: null,
                        useTEM: {},
                        useUISM: {},
                        useCM: { showOnlyInCompleteTodos: false },
                        useTG: { groups: [], isLoading: false, refresh: vi.fn(async () => {}) },
                        hostZIndex: 13200,
                    } as never)}
                />
            </CssVarsProvider>
        );
        expect(seen.pane?.hostZIndex).toBe(13200);
        expect(seen.pane?.hostedInModal).toBe(true);
        vi.doUnmock("../features/chat/ToDoPane");
    });
});

describe("ToDoPane → its dialogs", () => {
    const mountPane = (props: Record<string, unknown>) => {
        const base = {
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
            myself: { userId: "u", teamId: "t" },
            useTEM: {},
            useUISM: {},
            setMyself: vi.fn(),
            socket: null,
        };
        render(
            <CssVarsProvider>
                <ToDoPane {...({ ...base, ...props } as never)} />
            </CssVarsProvider>
        );
        fireEvent.click(screen.getByRole("button", { name: en.chat.todoPane.schedule.tooltip }));
        return Number(
            getComputedStyle(
                screen.getByRole("dialog").closest('[role="presentation"]') as HTMLElement
            ).zIndex
        );
    };

    it("Scheduled todos opens above a modal-hosted pane", () => {
        expect(mountPane({ hostedInModal: true, hostZIndex: 10020 })).toBe(10030);
    });

    it("a host layer is ignored on the page (not modal-hosted)", () => {
        const z = mountPane({ hostedInModal: false, hostZIndex: 10020 });
        expect(Number.isNaN(z) || z < 10000).toBe(true);
    });
});
